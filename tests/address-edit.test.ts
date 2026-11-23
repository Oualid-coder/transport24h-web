// Modification d'adresse côté client : bouton avant paiement, message + contact une fois la
// course payée (price_locked de l'API), comportement précédent si l'API n'envoie pas le champ.
import { test } from "node:test"
import assert from "node:assert/strict"
import { ADDRESS_PAID_MESSAGE, addressEditAction, addressEditErrorMessage } from "../lib/booking-status"
import { errorMessage } from "../lib/error-message"
import { ApiError } from "../lib/api"

const now = new Date("2026-11-19T10:00:00Z")
const future = "2026-11-25T09:00:00Z"
const past = "2026-11-18T09:00:00Z"

test("adresse : course non payée → bouton (inchangé)", () => {
  for (const status of ["awaiting_payment", "pending_review", "confirmed"] as const) {
    assert.equal(addressEditAction({ status, scheduled_at: future, price_locked: false }, now), "edit")
  }
})

test("adresse : course payée → message, pas de bouton", () => {
  for (const status of ["pending_review", "confirmed"] as const) {
    assert.equal(addressEditAction({ status, scheduled_at: future, price_locked: true }, now), "paid")
  }
})

test("adresse : price_locked absent (ancienne API) → bouton, comme avant", () => {
  assert.equal(addressEditAction({ status: "confirmed", scheduled_at: future }, now), "edit")
})

test("adresse : statut non modifiable ou course passée → rien, payée ou non", () => {
  for (const price_locked of [true, false, undefined]) {
    for (const status of ["payment_processing", "payment_failed", "assigned", "done", "cancelled"] as const) {
      assert.equal(addressEditAction({ status, scheduled_at: future, price_locked }, now), "none")
    }
    assert.equal(addressEditAction({ status: "confirmed", scheduled_at: past, price_locked }, now), "none")
  }
})

test("adresse : le 409 de l'API (payée entre-temps) s'affiche tel quel", () => {
  const err = new ApiError(409, ADDRESS_PAID_MESSAGE)
  assert.equal(errorMessage(err, "repli"), ADDRESS_PAID_MESSAGE)
  assert.equal(err.message, ADDRESS_PAID_MESSAGE)
})

// Modale d'adresse : messages par statut de PUT /bookings/{id}/address (textes de l'API, handler
// UpdateAddress). Avant : err.message brut pour toute ApiError.
test("modale adresse : 409 « déjà payée » reconnu → liens de contact et rafraîchissement", () => {
  assert.deepEqual(addressEditErrorMessage(new ApiError(409, ADDRESS_PAID_MESSAGE)), { message: ADDRESS_PAID_MESSAGE, paid: true })
  assert.deepEqual(addressEditErrorMessage(new ApiError(409, ` ${ADDRESS_PAID_MESSAGE} `)).paid, true)
})

test("modale adresse : messages métier des cas non payés inchangés (première lettre en majuscule)", () => {
  const cases: Array<[number, string, string]> = [
    [409, "la course est déjà passée, l'adresse ne peut plus être modifiée", "La course est déjà passée, l'adresse ne peut plus être modifiée"],
    [409, "la réservation ne peut pas être modifiée dans son état actuel", "La réservation ne peut pas être modifiée dans son état actuel"],
    [422, "indiquez au moins une adresse à modifier", "Indiquez au moins une adresse à modifier"],
    [422, "adresse ou coordonnées invalides : une adresse fait de 5 à 500 caractères", "Adresse ou coordonnées invalides : une adresse fait de 5 à 500 caractères"],
    [422, "adresse non localisée : choisissez l'adresse dans la liste de suggestions", "Adresse non localisée : choisissez l'adresse dans la liste de suggestions"],
    [403, "cette réservation ne vous appartient pas", "Cette réservation ne vous appartient pas"],
    [404, "réservation introuvable", "Réservation introuvable."],
  ]
  for (const [status, api, shown] of cases) {
    const r = addressEditErrorMessage(new ApiError(status, api))
    assert.equal(r.paid, false, api)
    assert.equal(r.message, shown)
  }
})

test("modale adresse : 400, 5xx et réseau → repli ; 429/503 → message d'attente", () => {
  const fallback = "Une erreur est survenue. Veuillez réessayer."
  for (const [status, api] of [[400, "body JSON invalide"], [400, "id invalide"], [500, "erreur lors de la mise à jour de l'adresse"], [502, "Bad Gateway"]] as const) {
    assert.deepEqual(addressEditErrorMessage(new ApiError(status, api)), { message: fallback, paid: false })
  }
  assert.deepEqual(addressEditErrorMessage(new TypeError("Failed to fetch")), { message: fallback, paid: false })
  for (const status of [429, 503]) {
    const r = addressEditErrorMessage(new ApiError(status, "x"))
    assert.equal(r.paid, false)
    assert.notEqual(r.message, fallback)
    assert.notEqual(r.message, "x")
  }
  // Autre 409 dont le texte diffère : pas confondu avec « déjà payée ».
  assert.equal(addressEditErrorMessage(new ApiError(409, "Votre course est déjà payée.")).paid, false)
})
