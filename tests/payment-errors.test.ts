import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError } from "../lib/api"
import { confirmSetupErrorMessage } from "../lib/payment-errors"

test("confirm-setup : 402 carte refusée → message de l'API", () => {
  const msg = "Votre carte a été refusée par votre banque. Essayez avec une autre carte."
  assert.equal(confirmSetupErrorMessage(new ApiError(402, msg)), msg)
  assert.equal(confirmSetupErrorMessage(new ApiError(402, "")), "Votre carte a été refusée. Essayez avec une autre carte.")
})

test("confirm-setup : autres statuts inchangés", () => {
  assert.match(confirmSetupErrorMessage(new ApiError(404, "x")), /introuvable/)
  assert.match(confirmSetupErrorMessage(new ApiError(409, "x")), /ne peut plus être payée/)
  assert.match(confirmSetupErrorMessage(new ApiError(500, "x")), /réessayer dans quelques instants/)
  assert.match(confirmSetupErrorMessage(new Error("réseau")), /réessayer dans quelques instants/)
})

test("confirm-setup : 429/503 → message passager, sans message brut de l'API pour 403/422", () => {
  assert.equal(confirmSetupErrorMessage(new ApiError(429, "trop de requêtes", 12)), "Trop de demandes en ce moment, réessayez dans 12 s.")
  assert.equal(confirmSetupErrorMessage(new ApiError(503, "")), "Service momentanément indisponible, réessayez.")
  assert.match(confirmSetupErrorMessage(new ApiError(422, "booking non payé ou sans PaymentIntent")), /réessayer dans quelques instants/)
  assert.match(confirmSetupErrorMessage(new ApiError(403, "x")), /réessayer dans quelques instants/)
})
