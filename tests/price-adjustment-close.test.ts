// Clôture par l'admin d'un ajustement bloqué (reprise automatique expirée) : bouton, saisie,
// corps envoyé (confirmation et motif obligatoires), messages. Lancer : npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError, closePriceAdjustment } from "../lib/api"
import {
  buildCloseBody,
  canClose,
  canResume,
  closeConfirmationQuestion,
  closeErrorMessage,
  closeFormError,
  closureSummary,
  isCloseFinish,
  partialRefundedCents,
} from "../lib/price-adjustment"
import type { PriceAdjustmentCloseOutcome } from "../lib/types"

const nb = (s: string) => s.replace(/(\d) (?=\d)/g, "$1 ").replace(/ €/g, " €")

const both: PriceAdjustmentCloseOutcome[] = ["not_executed", "executed"]

test("canClose / canResume : selon closable_outcomes de l'API", () => {
  // Appel Stripe de plus de 24 h : clôture (deux issues), plus de reprise.
  assert.equal(canClose({ status: "pending", closable_outcomes: both }), true)
  assert.equal(canResume({ status: "pending", closable_outcomes: both }), false)
  // Jamais envoyée à Stripe, ancienne : clôture « aucune opération » et reprise toujours possibles.
  assert.equal(canClose({ status: "pending", closable_outcomes: ["not_executed"] }), true)
  assert.equal(canResume({ status: "pending", closable_outcomes: ["not_executed"] }), true)
  // Récente ou étape Stripe enregistrée : reprise seule.
  assert.equal(canClose({ status: "pending", closable_outcomes: [] }), false)
  assert.equal(canResume({ status: "pending", closable_outcomes: [] }), true)
  // Ancienne API (champ absent) : comportement précédent.
  assert.equal(canClose({ status: "pending" }), false)
  assert.equal(canResume({ status: "pending" }), true)
  // Lignes terminées : ni l'un ni l'autre, même si le champ était incohérent.
  for (const status of ["succeeded", "failed"]) {
    assert.equal(canClose({ status, closable_outcomes: both }), false)
    assert.equal(canResume({ status, closable_outcomes: both }), false)
  }
})

test("closeFormError : issue proposée, identifiant Stripe selon le sens, motif", () => {
  const hausse = { delta_cents: 3000, closable_outcomes: both }
  const baisse = { delta_cents: -2400, closable_outcomes: both }
  assert.match(closeFormError(hausse, { outcome: null, reason: "x", stripeIds: "" }) ?? "", /Choisissez/)
  assert.equal(closeFormError(hausse, { outcome: "not_executed", reason: "Vérifié", stripeIds: "" }), null)
  assert.equal(closeFormError(hausse, { outcome: "not_executed", reason: "  ", stripeIds: "" }), "Le motif est requis.")
  assert.match(closeFormError(hausse, { outcome: "not_executed", reason: "é".repeat(501), stripeIds: "" }) ?? "", /500/)
  // Issue non proposée par l'API (jamais envoyée à Stripe) : refusée.
  assert.match(
    closeFormError({ delta_cents: 3000, closable_outcomes: ["not_executed"] }, { outcome: "executed", reason: "x", stripeIds: "pi_ABCdef12345678" }) ?? "",
    /Choisissez/,
  )
  assert.equal(closeFormError(hausse, { outcome: "executed", reason: "x", stripeIds: " pi_ABCdef12345678 " }), null)
  for (const bad of ["", "re_ABCdef12345678", "pi_123", "pi_ABC<def>12345"]) {
    assert.match(closeFormError(hausse, { outcome: "executed", reason: "x", stripeIds: bad }) ?? "", /pi_/, bad)
  }
  assert.equal(closeFormError(baisse, { outcome: "executed", reason: "x", stripeIds: "re_ABCdef12345678, re_XYZdef12345678" }), null)
  for (const bad of ["", "pi_ABCdef12345678", "re_ABCdef12345678;re_XYZdef12345678"]) {
    assert.match(closeFormError(baisse, { outcome: "executed", reason: "x", stripeIds: bad }) ?? "", /re_/, bad)
  }
})

test("buildCloseBody : confirmed_in_stripe toujours true, stripe_ids seulement si l'opération a eu lieu", () => {
  assert.deepEqual(buildCloseBody({ outcome: "not_executed", reason: "  Vérifié  ", stripeIds: "pi_ABCdef12345678" }), {
    outcome: "not_executed",
    reason: "Vérifié",
    confirmed_in_stripe: true,
  })
  assert.deepEqual(buildCloseBody({ outcome: "executed", reason: "Vu", stripeIds: " re_A1234567 , re_B1234567 " }), {
    outcome: "executed",
    reason: "Vu",
    stripe_ids: "re_A1234567,re_B1234567",
    confirmed_in_stripe: true,
  })
})

test("closeConfirmationQuestion : montant, sens et conséquence", () => {
  assert.equal(
    closeConfirmationQuestion({ delta_cents: 3000 }, "not_executed"),
    nb("Confirmer qu'aucun débit de 30,00 € n'apparaît dans Stripe ? L'ajustement sera marqué échoué, le prix reste inchangé."),
  )
  assert.match(closeConfirmationQuestion({ delta_cents: -2400 }, "executed"), /remboursement de 24,00.€ a eu lieu.*sans nouveau remboursement/)
  assert.match(closeConfirmationQuestion({ delta_cents: 3000 }, "executed"), /sans nouveau débit/)
})

test("API : POST …/close, corps exact ; 409 et 422 de l'API affichés", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const original = globalThis.fetch
  const responses = [
    () => Response.json({ adjustment: { id: "a1", status: "failed", closure_outcome: "not_executed" } }),
    () => Response.json({ error: "Cet ajustement a déjà été clos." }, { status: 409 }),
    () => Response.json({ error: "Identifiant Stripe invalide : PaymentIntent pi_… attendu." }, { status: 422 }),
    () => Response.json({ error: "erreur lors de l'ajustement du prix" }, { status: 500 }),
  ]
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return responses.shift()!()
  }) as typeof fetch
  try {
    const body = buildCloseBody({ outcome: "not_executed", reason: "Vérifié", stripeIds: "" })
    const { adjustment } = await closePriceAdjustment("b1", "a1", body)
    assert.equal(adjustment.status, "failed")
    assert.equal(calls[0].url, "/api/proxy/admin/bookings/b1/price-adjustments/a1/close")
    assert.equal(calls[0].init.method, "POST")
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { outcome: "not_executed", reason: "Vérifié", confirmed_in_stripe: true })

    const messages: string[] = []
    for (let i = 0; i < 3; i++) {
      try {
        await closePriceAdjustment("b1", "a1", body)
        assert.fail("erreur attendue")
      } catch (err) {
        assert.ok(err instanceof ApiError)
        messages.push(closeErrorMessage(err))
      }
    }
    assert.deepEqual(messages, [
      "Cet ajustement a déjà été clos.",
      "Identifiant Stripe invalide : PaymentIntent pi_… attendu.",
      "La clôture n'a pas pu être enregistrée : rechargez l'historique avant de réessayer.",
    ])
  } finally {
    globalThis.fetch = original
  }
})

test("closureSummary : trace d'une ligne close à la main", () => {
  assert.equal(closureSummary({ closure_outcome: null }), null)
  assert.equal(closureSummary({}), null)
  assert.match(
    closureSummary({ closure_outcome: "executed", closed_at: "2026-11-21T09:00:00Z", closure_reason: "Vu dans Stripe" }) ?? "",
    /^Clos à la main le .+ : opération constatée dans Stripe · Motif : Vu dans Stripe$/,
  )
  assert.equal(closureSummary({ closure_outcome: "not_executed" }), "Clos à la main : aucune opération dans Stripe")
})

const parts = [
  { payment_intent: "pi_orig", amount_cents: 2000 },
  { payment_intent: "pi_extra", amount_cents: 1000 },
]
const splitDecrease = { delta_cents: -3000, closable_outcomes: ["not_executed", "executed", "partial"] as PriceAdjustmentCloseOutcome[], refund_parts: parts }

test("issue partielle : une entrée par part, au moins une remboursée et une non exécutée, pas de doublon", () => {
  const f = (partIds: string[]) => closeFormError(splitDecrease, { outcome: "partial", reason: "Vu", stripeIds: "", partIds })
  assert.equal(f(["re_ABCdef12345678", ""]), null)
  assert.equal(f(["", " re_ABCdef12345678 "]), null)
  assert.match(f(["", ""]) ?? "", /au moins une part/)
  assert.match(f(["re_ABCdef12345678", "re_XYZdef12345678"]) ?? "", /au moins une part/)
  assert.match(f(["pi_ABCdef12345678", ""]) ?? "", /invalide/)
  // Issue non proposée par l'API (une seule part) : refusée.
  assert.match(
    closeFormError({ ...splitDecrease, closable_outcomes: ["not_executed", "executed"] }, { outcome: "partial", reason: "x", stripeIds: "", partIds: ["re_ABCdef12345678", ""] }) ?? "",
    /Choisissez/,
  )
  // executed d'une baisse : même re_ deux fois refusé.
  assert.match(
    closeFormError(splitDecrease, { outcome: "executed", reason: "x", stripeIds: "re_ABCdef12345678,re_ABCdef12345678" }) ?? "",
    /deux fois/,
  )
})

test("issue partielle : corps, montant remboursé et question de confirmation", () => {
  assert.deepEqual(buildCloseBody({ outcome: "partial", reason: " Vu ", stripeIds: "ignoré", partIds: [" re_ABCdef12345678 ", ""] }), {
    outcome: "partial",
    reason: "Vu",
    refund_parts: ["re_ABCdef12345678", ""],
    confirmed_in_stripe: true,
  })
  assert.equal(partialRefundedCents(parts, ["re_ABCdef12345678", ""]), 2000)
  assert.equal(partialRefundedCents(parts, ["", "re_ABCdef12345678"]), 1000)
  assert.equal(
    closeConfirmationQuestion(splitDecrease, "partial", ["re_ABCdef12345678", ""]),
    nb("Confirmer que seuls 20,00 € sur 30,00 € ont été remboursés dans Stripe ? Un avoir de ce montant sera émis, le reste n'est pas remboursé et le prix reste inchangé."),
  )
  assert.match(closureSummary({ closure_outcome: "partial" }) ?? "", /remboursement partiel/)
})

test("clôture enregistrée dont la suite a échoué : bouton pour tout admin, sans nouvelle saisie", () => {
  const finishing = { status: "pending", delta_cents: 3000, closure_outcome: "executed" as const, closable_outcomes: ["executed"] as PriceAdjustmentCloseOutcome[] }
  assert.equal(isCloseFinish(finishing), true)
  assert.equal(canClose(finishing), true)
  assert.equal(canResume(finishing), false)
  assert.equal(closeFormError(finishing, { outcome: "executed", reason: "Terminer", stripeIds: "" }), null)
  assert.equal(isCloseFinish({ closure_outcome: null }), false)
})
