// Ajustement du prix d'une course payée (admin) : saisie, corps envoyé, messages d'erreur,
// confirmation, conservation du request_id après un résultat incertain. Lancer : npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError, createPriceAdjustment, getPriceAdjustments, previewPriceAdjustment } from "../lib/api"
import {
  UNCERTAIN_MESSAGE,
  adjustmentFailure,
  adjustmentFormError,
  adjustmentOutcome,
  attemptAfterFailure,
  attemptOnOpen,
  buildAdjustmentBody,
  canAdjustPrice,
  confirmationQuestion,
  formatCents,
  parseFrenchPrice,
  previewBlocker,
  resumeBody,
  type AttemptState,
} from "../lib/price-adjustment"

// Intl fr-FR : milliers séparés par U+202F (espace fine insécable), symbole précédé de U+00A0
const nb = (s: string) => s.replace(/(\d) (?=\d)/g, "$1\u202f").replace(/ €/g, "\u00a0€")

async function withFetch<T>(responses: Array<() => Response>, run: () => Promise<T>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const next = responses.shift()
    if (!next) throw new Error("appel inattendu")
    return next()
  }) as typeof fetch // signature simplifiée suffisante pour le test
  try {
    return { calls, result: await run() }
  } finally {
    globalThis.fetch = original
  }
}

test("canAdjustPrice : course payée, hors entreprise, ni annulée ni en cours de débit", () => {
  const paid = { price_locked: true, is_b2b: false, status: "confirmed" as const }
  assert.equal(canAdjustPrice(paid), true)
  assert.equal(canAdjustPrice({ ...paid, status: "done" }), true)
  assert.equal(canAdjustPrice({ ...paid, price_locked: false }), false)
  assert.equal(canAdjustPrice({ ...paid, is_b2b: true }), false)
  assert.equal(canAdjustPrice({ ...paid, status: "cancelled" }), false)
  assert.equal(canAdjustPrice({ ...paid, status: "payment_processing" }), false)
})

test("parseFrenchPrice : virgule, point, espaces de milliers ; refus du reste", () => {
  assert.equal(parseFrenchPrice("120"), 120)
  assert.equal(parseFrenchPrice("120,5"), 120.5)
  assert.equal(parseFrenchPrice(" 120,50 "), 120.5)
  assert.equal(parseFrenchPrice("120.50"), 120.5)
  assert.equal(parseFrenchPrice("1 234,56"), 1234.56)
  assert.equal(parseFrenchPrice("1\u00a0234,56"), 1234.56)
  assert.equal(parseFrenchPrice(nb("1 234,56")), 1234.56)
  for (const bad of ["", "abc", "0", "0,00", "-10", "12,345", "1,2,3", "1.234,56", "12€", "1e3"]) {
    assert.equal(parseFrenchPrice(bad), null, bad)
  }
})

test("formatCents : centimes → euros français", () => {
  assert.equal(formatCents(1234), nb("12,34 €"))
  assert.equal(formatCents(123456), nb("1 234,56 €"))
  assert.equal(formatCents(5), nb("0,05 €"))
})

test("adjustmentFormError : prix, prix identique, motif requis et ≤ 500, accord du client", () => {
  const ok = { priceInput: "150,00", reason: "Étage en plus", clientAgreed: true, currentPriceHT: 120 }
  assert.equal(adjustmentFormError(ok), null)
  assert.match(adjustmentFormError({ ...ok, priceInput: "abc" }) ?? "", /invalide/)
  assert.match(adjustmentFormError({ ...ok, priceInput: "120,00" }) ?? "", /identique/)
  assert.equal(adjustmentFormError({ ...ok, reason: "   " }), "Le motif est requis.")
  assert.equal(adjustmentFormError({ ...ok, reason: "é".repeat(500) }), null)
  assert.match(adjustmentFormError({ ...ok, reason: "é".repeat(501) }) ?? "", /500 caractères/)
  // 500 émojis = 1000 unités UTF-16 : comptés comme 500 caractères
  assert.equal(adjustmentFormError({ ...ok, reason: "🚚".repeat(500) }), null)
  assert.match(adjustmentFormError({ ...ok, clientAgreed: false }) ?? "", /accord/)
})

test("buildAdjustmentBody : client_agreed true, motif nettoyé, request_id transmis", () => {
  assert.deepEqual(buildAdjustmentBody(150.5, "  Étage en plus \n", "id-1"), {
    new_price_ht: 150.5,
    reason: "Étage en plus",
    client_agreed: true,
    request_id: "id-1",
  })
})

test("confirmationQuestion : montant et sens répétés", () => {
  assert.equal(confirmationQuestion({ delta_cents: 1234 }), nb("Débiter 12,34 € sur la carte du client ?"))
  assert.equal(confirmationQuestion({ delta_cents: -1234 }), nb("Rembourser 12,34 € au client ?"))
  assert.equal(confirmationQuestion({ delta_cents: 0 }), null)
})

test("adjustmentFailure : 402 message de l'API, refus définitifs, résultats incertains", () => {
  assert.deepEqual(adjustmentFailure(new ApiError(402, "votre carte a été refusée"), false), {
    kind: "definitive",
    message: "Votre carte a été refusée",
  })
  assert.equal(
    adjustmentFailure(new ApiError(402, ""), false).message,
    "Opération refusée par la banque : rien n'a été débité, remboursé ni émis, le prix est inchangé.",
  )
  assert.deepEqual(adjustmentFailure(new ApiError(409, "un autre ajustement est en cours"), false), {
    kind: "definitive",
    message: "Un autre ajustement est en cours",
  })
  assert.deepEqual(adjustmentFailure(new ApiError(422, "le motif est obligatoire"), false), {
    kind: "definitive",
    message: "Le motif est obligatoire",
  })
  assert.equal(adjustmentFailure(new ApiError(400, "body JSON invalide"), false).message, "L'ajustement n'a pas pu être effectué.")
  // 503 : message propre à l'ajustement, pas « Service momentanément indisponible »
  for (const err of [new ApiError(503, "résultat incertain, réessayez"), new ApiError(503, ""),
    new ApiError(502, "Backend inaccessible"), new ApiError(504, ""), new TypeError("Failed to fetch")]) {
    assert.deepEqual(adjustmentFailure(err, false), { kind: "uncertain", message: UNCERTAIN_MESSAGE })
  }
  assert.equal(adjustmentFailure(new ApiError(429, "", 30), false).kind, "uncertain")
  assert.match(adjustmentFailure(new ApiError(429, "", 30), false).message, /30 s/)
  // Après un résultat incertain, un 409 peut être l'essai précédent encore en cours : on garde le même essai
  assert.deepEqual(adjustmentFailure(new ApiError(409, "un autre ajustement est en cours"), true), {
    kind: "uncertain",
    message: "Un autre ajustement est en cours",
  })
  assert.equal(adjustmentFailure(new ApiError(402, "carte refusée"), true).kind, "definitive")
})

test("adjustmentFailure : 500 → même request_id et « Réessayer », message de l'API sinon message incertain", () => {
  const partial = "Remboursement partiel : 10,00 € remboursés (avoir émis), le reste a été refusé par Stripe."
  assert.deepEqual(adjustmentFailure(new ApiError(500, partial), false), { kind: "uncertain", message: partial })
  assert.deepEqual(adjustmentFailure(new ApiError(500, "erreur lors de l'ajustement du prix"), true), {
    kind: "uncertain",
    message: "Erreur lors de l'ajustement du prix",
  })
  assert.equal(adjustmentFailure(new ApiError(500, ""), false).message, UNCERTAIN_MESSAGE)
  assert.equal(adjustmentFailure(new ApiError(500, "pq: deadlock detected"), false).message, UNCERTAIN_MESSAGE)
  // Une ligne « pending » laissée par un 500 ne se reprend qu'avec le même request_id
  assert.deepEqual(
    attemptAfterFailure({ requestId: "id-1", locked: false }, adjustmentFailure(new ApiError(500, ""), false).kind, () => "id-2"),
    { requestId: "id-1", locked: true },
  )
})

test("adjustmentFailure : 409 « interrompu depuis plus de 23 h » → flux arrêté, plus de « Réessayer »", () => {
  const stale =
    "Ajustement interrompu depuis plus de 23 h : à vérifier dans Stripe avant toute nouvelle action. Aucune opération refaite."
  assert.deepEqual(adjustmentFailure(new ApiError(409, stale), true), { kind: "stopped", message: stale })
  assert.equal(adjustmentFailure(new ApiError(409, stale), false).kind, "stopped")
  assert.equal(adjustmentFailure(new ApiError(409, "Un autre ajustement de prix est déjà en cours sur cette course."), true).kind, "uncertain")
  assert.equal(adjustmentFailure(new ApiError(409, "", null), true).kind, "uncertain")
  assert.deepEqual(attemptAfterFailure({ requestId: "id-1", locked: true }, "stopped", () => "id-2"), {
    requestId: "id-2",
    locked: false,
  })
})

test("adjustmentFailure : 409 « autres paramètres » (reprise par un autre admin) → flux arrêté", () => {
  const conflict = "Cette demande a déjà été envoyée avec d'autres paramètres."
  assert.deepEqual(adjustmentFailure(new ApiError(409, conflict), true), { kind: "stopped", message: conflict })
  assert.equal(adjustmentFailure(new ApiError(409, conflict), false).kind, "stopped")
  assert.equal(adjustmentFailure(new ApiError(409, "Un autre ajustement de prix est déjà en cours sur cette course."), true).kind, "uncertain")
})

test("resumeBody : exactement le prix, le motif et le request_id de la ligne interrompue", () => {
  assert.deepEqual(
    resumeBody({ new_price_ht: 80.5, reason: " Moins d'étages ", request_id: "44444444-4444-4444-8444-444444444444" }),
    { new_price_ht: 80.5, reason: " Moins d'étages ", client_agreed: true, request_id: "44444444-4444-4444-8444-444444444444" },
  )
})

test("adjustmentOutcome : seul « succeeded » est un succès ; « failed » rejoué = échec ; inconnu = en cours", () => {
  assert.equal(adjustmentOutcome("succeeded"), "succeeded")
  assert.equal(adjustmentOutcome("failed"), "failed")
  assert.equal(adjustmentOutcome("pending"), "pending")
  assert.equal(adjustmentOutcome("completed"), "pending")
})

test("previewBlocker : baisse supérieure au remboursable refusée avant l'envoi", () => {
  assert.equal(previewBlocker({ delta_cents: -2000, refundable_cents: 2000 }), null)
  assert.equal(previewBlocker({ delta_cents: 5000, refundable_cents: 0 }), null)
  assert.equal(
    previewBlocker({ delta_cents: -2001, refundable_cents: 2000 }),
    nb("Baisse impossible : au plus 20,00 € peuvent encore être remboursés au client."),
  )
})

test("request_id : conservé après 503 (même à la réouverture), neuf après refus définitif ou succès", () => {
  let n = 0
  const newId = () => `id-${++n}`
  let s: AttemptState = attemptOnOpen(null, newId)
  assert.deepEqual(s, { requestId: "id-1", locked: false })
  s = attemptAfterFailure(s, adjustmentFailure(new ApiError(503, ""), false).kind, newId)
  assert.deepEqual(s, { requestId: "id-1", locked: true })
  s = attemptAfterFailure(s, adjustmentFailure(new TypeError("Failed to fetch"), true).kind, newId)
  assert.deepEqual(s, { requestId: "id-1", locked: true })
  s = attemptOnOpen(s, newId) // fermeture puis réouverture pendant l'incertitude
  assert.deepEqual(s, { requestId: "id-1", locked: true })
  s = attemptAfterFailure(s, adjustmentFailure(new ApiError(402, "carte refusée"), true).kind, newId)
  assert.deepEqual(s, { requestId: "id-2", locked: false })
  s = attemptOnOpen({ ...s, locked: false }, newId) // après un succès
  assert.deepEqual(s, { requestId: "id-3", locked: false })
})

test("API : 503 puis 200, le nouvel essai renvoie exactement le même corps (même request_id)", async () => {
  const body = buildAdjustmentBody(150, "Étage en plus", "3f1e2d4c-5b6a-4789-8abc-def012345678")
  const adjustment = {
    id: "adj-1", booking_id: "b1", direction: "increase", old_price_ht: 120, new_price_ht: 150, delta_cents: 3600,
    status: "succeeded", reason: "Étage en plus", admin_id: "a1", request_id: "3f1e2d4c-5b6a-4789-8abc-def012345678", created_at: "2026-11-19T10:00:00Z",
    completed_at: "2026-11-19T10:00:01Z", credit_note_number: null, invoice_number: "FACT-2026-0042",
  }
  const { calls, result } = await withFetch(
    [
      () => Response.json({ error: "résultat incertain, réessayez" }, { status: 503 }),
      () => Response.json({ adjustment }, { status: 200 }),
    ],
    async () => {
      let state: AttemptState = { requestId: body.request_id, locked: false }
      try {
        await createPriceAdjustment("b1", body)
        assert.fail("503 attendu")
      } catch (err) {
        state = attemptAfterFailure(state, adjustmentFailure(err, false).kind, () => "autre-id")
      }
      assert.equal(state.requestId, body.request_id)
      return createPriceAdjustment("b1", buildAdjustmentBody(150, "Étage en plus", state.requestId))
    },
  )
  assert.equal(calls.length, 2)
  for (const c of calls) {
    assert.equal(c.url, "/api/proxy/admin/bookings/b1/price-adjustments")
    assert.equal(c.init.method, "POST")
  }
  assert.equal(calls[0].init.body, calls[1].init.body)
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), {
    new_price_ht: 150, reason: "Étage en plus", client_agreed: true, request_id: body.request_id,
  })
  assert.equal(result.adjustment.invoice_number, "FACT-2026-0042")
})

test("API : 402 → ApiError avec le message de l'API", async () => {
  await assert.rejects(
    withFetch([() => Response.json({ error: "Débit refusé par la banque du client." }, { status: 402 })], () =>
      createPriceAdjustment("b1", buildAdjustmentBody(150, "x", "id")),
    ),
    { name: "ApiError", status: 402, message: "Débit refusé par la banque du client." },
  )
})

test("API : aperçu (GET, new_price_ht en query) et historique", async () => {
  const preview = {
    old_price_ht: 120, new_price_ht: 100.5, old_price_ttc_cents: 14400, new_price_ttc_cents: 12060,
    delta_cents: -2340, direction: "decrease", charged_cents: 14400, refundable_cents: 14400,
  }
  const { calls, result } = await withFetch([() => Response.json(preview)], () => previewPriceAdjustment("b1", 100.5))
  assert.equal(calls[0].url, "/api/proxy/admin/bookings/b1/price-adjustments/preview?new_price_ht=100.5")
  assert.equal(calls[0].init.method, undefined) // GET
  assert.equal(confirmationQuestion(result), nb("Rembourser 23,40 € au client ?"))

  const h = await withFetch([() => Response.json({ adjustments: [] })], () => getPriceAdjustments("b1"))
  assert.equal(h.calls[0].url, "/api/proxy/admin/bookings/b1/price-adjustments")
  assert.deepEqual(h.result, { adjustments: [] })
})
