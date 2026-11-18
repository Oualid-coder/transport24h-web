import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError } from "../lib/api"
import { errorMessage, transientErrorMessage } from "../lib/error-message"
import { retryErrorMessage } from "../lib/credit-note-errors"

const FALLBACK = "Une erreur est survenue. Veuillez réessayer."

test("errorMessage : 429 → délai de Retry-After, sinon « quelques instants »", () => {
  assert.equal(
    errorMessage(new ApiError(429, "trop de requêtes, réessayez dans 60s", 60), FALLBACK),
    "Trop de demandes en ce moment, réessayez dans 60 s.",
  )
  assert.equal(
    errorMessage(new ApiError(429, "", null), FALLBACK),
    "Trop de demandes en ce moment, réessayez dans quelques instants.",
  )
})

test("errorMessage : 503 → service indisponible, même si le message est vide ou anglais", () => {
  assert.equal(errorMessage(new ApiError(503, "Service Unavailable"), FALLBACK), "Service momentanément indisponible, réessayez.")
  assert.equal(errorMessage(new ApiError(503, ""), FALLBACK), "Service momentanément indisponible, réessayez.")
})

test("errorMessage : 403/409/413/422 → message métier de l'API, majuscule initiale", () => {
  assert.equal(errorMessage(new ApiError(403, "cette course ne vous est pas assignée"), FALLBACK), "Cette course ne vous est pas assignée")
  assert.equal(errorMessage(new ApiError(409, "Déjà pris"), FALLBACK), "Déjà pris")
  assert.equal(errorMessage(new ApiError(413, "photo trop volumineuse (max 8 Mo)"), FALLBACK), "Photo trop volumineuse (max 8 Mo)")
  assert.equal(errorMessage(new ApiError(422, "chauffeur introuvable ou inactif"), FALLBACK), "Chauffeur introuvable ou inactif")
})

test("errorMessage : message vide, 400, 404, 5xx, 401, erreur non API → repli", () => {
  assert.equal(errorMessage(new ApiError(409, "  "), FALLBACK), FALLBACK)
  assert.equal(errorMessage(new ApiError(400, "body JSON invalide"), FALLBACK), FALLBACK)
  assert.equal(errorMessage(new ApiError(404, "réservation introuvable"), FALLBACK), FALLBACK)
  assert.equal(errorMessage(new ApiError(500, "erreur serveur"), FALLBACK), FALLBACK)
  assert.equal(errorMessage(new ApiError(502, "Backend inaccessible"), FALLBACK), FALLBACK)
  assert.equal(errorMessage(new ApiError(401, "Non autorisé"), FALLBACK), FALLBACK)
  assert.equal(errorMessage(new Error("Failed to fetch"), FALLBACK), FALLBACK)
  assert.equal(errorMessage(null, FALLBACK), FALLBACK)
})

test("transientErrorMessage : seulement 429 et 503", () => {
  assert.match(transientErrorMessage(new ApiError(429, "", 5)) ?? "", /dans 5 s/)
  assert.match(transientErrorMessage(new ApiError(503, "")) ?? "", /indisponible/)
  assert.equal(transientErrorMessage(new ApiError(409, "conflit")), null)
  assert.equal(transientErrorMessage(new ApiError(422, "x")), null)
  assert.equal(transientErrorMessage(new Error("x")), null)
})

test("retryErrorMessage (avoirs) : traductions 404/409/422 inchangées", () => {
  assert.equal(retryErrorMessage(new ApiError(404, "x")), "Plus rien à émettre pour ce remboursement.")
  assert.match(retryErrorMessage(new ApiError(409, "x")), /^Vérification Stripe requise/)
  assert.match(retryErrorMessage(new ApiError(422, "x")), /^Aucune facture d'origine/)
})

test("retryErrorMessage (avoirs) : 429/503 lisibles, repli inchangé", () => {
  assert.equal(retryErrorMessage(new ApiError(429, "", 30)), "Trop de demandes en ce moment, réessayez dans 30 s.")
  assert.equal(retryErrorMessage(new ApiError(503, "avoirs désactivés")), "Service momentanément indisponible, réessayez.")
  assert.equal(retryErrorMessage(new ApiError(500, "x")), "L'avoir n'a pas pu être émis. Réessayez dans quelques instants.")
  assert.equal(retryErrorMessage(new Error("réseau")), "L'avoir n'a pas pu être émis. Réessayez dans quelques instants.")
})
