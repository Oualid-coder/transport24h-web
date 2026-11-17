// Statut de paiement admin : toutes les valeurs de l'API ont un badge, les inconnues ne plantent pas
import { test } from "node:test"
import assert from "node:assert/strict"
import { PAYMENT_CONFIG, paymentBadge } from "../lib/payment-status"

test("payment_status : valeurs de l'API (paid, pending, failed, refunded, none) libellées", () => {
  assert.equal(paymentBadge("paid").label, "Payé")
  assert.equal(paymentBadge("pending").label, "Paiement en attente")
  assert.equal(paymentBadge("failed").label, "Paiement refusé")
  assert.equal(paymentBadge("refunded").label, "Remboursé")
  assert.equal(paymentBadge("none").label, "Non payé")
  for (const v of Object.values(PAYMENT_CONFIG)) assert.ok(v.className.length > 0)
})

test("payment_status : valeur inconnue ou absente → repli « Non payé »", () => {
  for (const v of ["succeeded", "inconnu", "", "toString", "__proto__", null, undefined]) {
    assert.deepEqual(paymentBadge(v), PAYMENT_CONFIG.none)
  }
})
