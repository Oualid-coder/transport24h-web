// Rapprochement Stripe (admin) : appels API (lecture, émission doublement confirmée), libellés,
// question de confirmation, messages d'erreur. Lancer : npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError, activateStripeAutoCreditNotes, getStripeReconciliation, issueStripeRefundCreditNote } from "../lib/api"
import {
  ACTIVATION_QUESTION,
  activationSuccessMessage,
  autoCreditNotesStatus,
  issueConfirmationQuestion,
  issueErrorMessage,
  issueSuccessMessage,
  listErrorMessage,
  originLabel,
  refundStatusLabel,
} from "../lib/stripe-reconciliation"

const nb = (s: string) => s.replace(/[  ]/g, " ")

async function withFetch<T>(response: () => Response, run: () => Promise<T>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return response()
  }) as typeof fetch
  try {
    return { calls, result: await run() }
  } finally {
    globalThis.fetch = original
  }
}

test("lecture : GET avec la période, sans corps", async () => {
  const body = {
    since: "2026-08-28T00:00:00Z",
    settings: { cutoff_at: null, activated_by: null, activated_at: null },
    truncated: false,
    refunds: [],
  }
  const { calls, result } = await withFetch(() => Response.json(body), () => getStripeReconciliation(90))
  assert.equal(calls[0].url, "/api/proxy/admin/stripe-reconciliation?days=90")
  assert.equal(calls[0].init?.method ?? "GET", "GET")
  assert.deepEqual(result, body)
})

test("émission : POST avec confirmed_in_stripe, identifiant encodé ; 201 et 200 (double clic)", async () => {
  for (const [status, created] of [[201, true], [200, false]] as const) {
    const { calls, result } = await withFetch(
      () => Response.json({ credit_note_id: "c1", credit_note_number: "AVOIR-2026-0007", amount_ttc: 42, created, counted_cents: 0 }, { status }),
      () => issueStripeRefundCreditNote("re_abc/../x"),
    )
    assert.equal(calls[0].url, "/api/proxy/admin/stripe-reconciliation/re_abc%2F..%2Fx/credit-note")
    assert.equal(calls[0].init.method, "POST")
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { confirmed_in_stripe: true })
    assert.equal(result.created, created)
    assert.equal(
      issueSuccessMessage(result),
      created ? "Avoir AVOIR-2026-0007 émis et envoyé au client." : "Avoir AVOIR-2026-0007 déjà émis : rien n'a été renvoyé.",
    )
  }
})

test("question de confirmation : montant, identifiant, course ; mise en garde avant mise en service", () => {
  const row = { amount_cents: 4250, stripe_refund_id: "re_1", booking_reference: "T24H-2026-0042", before_cutoff: false, count_cents: 4250 }
  const q = nb(issueConfirmationQuestion(row))
  assert.match(q, /42,50 €/)
  assert.match(q, /42,50 € seront ajoutés au total remboursé/)
  assert.match(nb(issueConfirmationQuestion({ ...row, count_cents: 0 })), /total remboursé de la course ne change pas/)
  assert.match(q, /re_1/)
  assert.match(q, /T24H-2026-0042/)
  assert.doesNotMatch(q, /antérieur/)
  assert.match(nb(issueConfirmationQuestion({ ...row, before_cutoff: true })), /antérieur à la mise en service/)
  assert.doesNotMatch(issueConfirmationQuestion({ ...row, booking_reference: "" }), /sur la course/)
})

test("erreurs : 404 traduit, 409/422 message de l'API, 5xx repli", () => {
  assert.equal(issueErrorMessage(new ApiError(404, "remboursement inconnu de Stripe")), "Remboursement introuvable dans Stripe : actualisez la liste.")
  const conflict = "les avoirs déjà émis pour cette course couvrent les remboursements Stripe : aucun avoir supplémentaire"
  assert.equal(issueErrorMessage(new ApiError(409, conflict)), "Les avoirs déjà émis pour cette course couvrent les remboursements Stripe : aucun avoir supplémentaire")
  assert.match(issueErrorMessage(new ApiError(422, "aucune facture d'origine pour cette course")), /^Aucune facture d'origine/)
  assert.equal(issueErrorMessage(new ApiError(502, "lecture du remboursement dans Stripe impossible : réessayer")), "Stripe ne répond pas : rien n'a été émis. Réessayez dans quelques instants.")
  assert.equal(issueErrorMessage(new ApiError(500, "erreur")), "L'avoir n'a pas pu être émis. Actualisez la liste avant de réessayer.")
  assert.equal(listErrorMessage(new ApiError(502, "lecture des remboursements Stripe impossible")), "Stripe ne répond pas : impossible de lire les remboursements. Réessayez avec « Actualiser ».")
  assert.equal(listErrorMessage(new ApiError(500, "erreur")), "Impossible de lire les remboursements Stripe. Réessayez avec « Actualiser ».")
})

test("libellés", () => {
  assert.equal(originLabel({ origin: "app" }), "Application")
  assert.equal(originLabel({ origin: "external" }), "Hors application")
  assert.equal(originLabel({ origin: "" }), "Inconnue (non suivie)")
  assert.equal(refundStatusLabel("succeeded"), "Réussi")
  assert.equal(refundStatusLabel("pending"), "En attente")
  assert.equal(refundStatusLabel("autre"), "autre")
})

test("activation : POST confirmé, 201 activé puis 200 déjà actif ; textes selon la coupure", async () => {
  for (const [status, activated] of [[201, true], [200, false]] as const) {
    const body = { settings: { cutoff_at: "2026-11-27T09:00:00Z", activated_by: "a1", activated_at: "2026-11-27T09:00:00Z" }, activated }
    const { calls, result } = await withFetch(() => Response.json(body, { status }), () => activateStripeAutoCreditNotes())
    assert.equal(calls[0].url, "/api/proxy/admin/stripe-reconciliation/activate")
    assert.equal(calls[0].init.method, "POST")
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { confirmed: true })
    const msg = nb(activationSuccessMessage(result))
    assert.match(msg, activated ? /^Avoirs automatiques activés \(mise en service : 27\/11\/2026 10:00\)/ : /déjà actifs depuis le 27\/11\/2026 10:00/)
  }
  assert.match(autoCreditNotesStatus({ cutoff_at: null }), /^Avoirs automatiques non activés/)
  assert.match(nb(autoCreditNotesStatus({ cutoff_at: "2026-11-27T09:00:00Z" })), /^Avoirs automatiques actifs depuis le 27\/11\/2026 10:00/)
  assert.match(ACTIVATION_QUESTION, /ne pourra plus être déplacée/)
})
