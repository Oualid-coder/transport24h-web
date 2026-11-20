// Modification d'adresse côté client : bouton avant paiement, message + contact une fois la
// course payée (price_locked de l'API), comportement précédent si l'API n'envoie pas le champ.
import { test } from "node:test"
import assert from "node:assert/strict"
import { ADDRESS_PAID_MESSAGE, addressEditAction } from "../lib/booking-status"
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
