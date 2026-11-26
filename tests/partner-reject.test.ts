// Refus d'une candidature partenaire, y compris approuvée (API : admin_partners.go, sujet 43)
import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError, rejectPartner } from "../lib/api"
import {
  REJECT_APPROVED_CONSEQUENCES,
  decisionErrorNeedsRefresh,
  rejectErrorMessage,
  rejectNeedsConfirmation,
} from "../lib/partner-reject"

const api409 =
  "refus impossible : le chauffeur a encore des courses affectées non terminées. Réaffectez-les à un autre chauffeur, ou faites-les clôturer par le chauffeur, avant de refuser la candidature"

test("confirmation en deux étapes : approuvée seulement (en attente : refus direct inchangé ; rejetée : aucun bouton)", () => {
  assert.equal(rejectNeedsConfirmation("approved"), true)
  assert.equal(rejectNeedsConfirmation("pending"), false)
  assert.equal(rejectNeedsConfirmation("rejected"), false)
})

test("conséquences annoncées : compte désactivé, sessions coupées, blocage si courses", () => {
  const text = REJECT_APPROVED_CONSEQUENCES.join(" ")
  assert.match(text, /désactivé/)
  assert.match(text, /sessions/)
  assert.match(text, /courses affectées non terminées/)
})

test("409 → message de l'API (majuscule) ; 404, 500, réseau → repli", () => {
  assert.equal(rejectErrorMessage(new ApiError(409, api409)), api409.charAt(0).toUpperCase() + api409.slice(1))
  const fallback = "La candidature n'a pas pu être rejetée. Réessayez."
  assert.equal(rejectErrorMessage(new ApiError(404, "candidature introuvable")), fallback)
  assert.equal(rejectErrorMessage(new ApiError(500, "erreur lors du rejet")), fallback)
  assert.equal(rejectErrorMessage(new TypeError("fetch failed")), fallback)
})

test("rejectPartner : PUT sur le proxy, 409 → ApiError avec le message de l'API", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return Response.json({ error: api409 }, { status: 409 })
  }) as typeof fetch // signature simplifiée suffisante pour le test
  try {
    await assert.rejects(rejectPartner("p1"), { name: "ApiError", status: 409, message: api409 })
  } finally {
    globalThis.fetch = original
  }
  assert.equal(calls[0].url, "/api/proxy/admin/partners/p1/reject")
  assert.equal(calls[0].init.method, "PUT")
})

test("échec d'approbation ou de refus : liste relue sur 409 et 404 seulement", () => {
  const refusedDuringApproval = new ApiError(409, "la candidature a été refusée pendant l'approbation : aucun compte chauffeur n'a été créé")
  assert.equal(decisionErrorNeedsRefresh(refusedDuringApproval), true)
  assert.equal(decisionErrorNeedsRefresh(new ApiError(409, api409)), true)
  assert.equal(decisionErrorNeedsRefresh(new ApiError(404, "candidature introuvable")), true)
  assert.equal(decisionErrorNeedsRefresh(new ApiError(500, "erreur lors de l'approbation")), false)
  assert.equal(decisionErrorNeedsRefresh(new ApiError(429, "trop de requêtes", 5)), false)
  assert.equal(decisionErrorNeedsRefresh(new TypeError("fetch failed")), false)
})
