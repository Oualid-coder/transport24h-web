// Traduction des refus de l'API : 422 « CGV obligatoires » (inscription, activation, candidature)
// et erreurs de POST /auth/accept-invitation (messages exacts de internal/handler/auth.go de l'API).
import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError } from "../lib/api"
import { TERMS_REQUIRED_MESSAGE } from "../lib/legal"
import {
  INVITATION_LINK_EXPIRED_MESSAGE,
  INVITATION_LINK_INVALID_MESSAGE,
  acceptInvitationErrorMessage,
  isTermsRequiredError,
  registerErrorMessage,
} from "../lib/register"

// Message exact de l'API (msgTermsRequired, branche feat/cgv-obligatoire)
const API_TERMS = "Vous devez accepter les CGV et la politique de confidentialité."
const GENERIC = "Une erreur est survenue. Veuillez réessayer."

test("isTermsRequiredError : seul le 422 CGV de l'API, casse et accents ignorés", () => {
  assert.equal(isTermsRequiredError(422, API_TERMS), true)
  assert.equal(isTermsRequiredError(422, "vous devez accepter les cgv et la politique de confidentialite"), true)
  assert.equal(isTermsRequiredError(400, API_TERMS), false)
  assert.equal(isTermsRequiredError(422, "Key: 'registerRequest.TermsVersion' Error:..."), false)
  assert.equal(isTermsRequiredError(422, "le mot de passe doit contenir au moins 8 caractères"), false)
})

test("inscription : 422 CGV → message de la case, pas « Certaines informations sont invalides »", () => {
  assert.equal(registerErrorMessage(422, API_TERMS), TERMS_REQUIRED_MESSAGE)
})

test("activation : 422 CGV → message de la case", () => {
  assert.equal(acceptInvitationErrorMessage(new ApiError(422, API_TERMS)), TERMS_REQUIRED_MESSAGE)
})

test("activation : jeton invalide ou déjà utilisé (422) et expiré (410) → nouveau lien", () => {
  const invalid = acceptInvitationErrorMessage(new ApiError(422, "lien d'invitation invalide ou déjà utilisé"))
  assert.equal(invalid, INVITATION_LINK_INVALID_MESSAGE)
  assert.match(invalid, /nouveau lien/)
  const expired = acceptInvitationErrorMessage(
    new ApiError(410, "ce lien d'invitation a expiré — contactez votre interlocuteur Transport24h"),
  )
  assert.equal(expired, INVITATION_LINK_EXPIRED_MESSAGE)
  assert.match(expired, /nouveau lien/)
})

test("activation : mot de passe trop court → message actuel, trop long → limite de 72", () => {
  assert.equal(
    acceptInvitationErrorMessage(new ApiError(422, "le mot de passe doit contenir au moins 8 caractères")),
    "Mot de passe invalide.",
  )
  assert.equal(
    acceptInvitationErrorMessage(
      new ApiError(422, "le mot de passe ne doit pas dépasser 72 octets (72 caractères sans accents)"),
    ),
    "Mot de passe trop long — 72 caractères maximum (sans accents).",
  )
})

test("activation : autre 422 (champ manquant, validateur Go) → message générique, jamais le texte technique", () => {
  for (const raw of [
    "token et password obligatoires",
    "Key: 'acceptInvitationRequest.TermsVersion' Error:Field validation for 'TermsVersion' failed on the 'terms_version' tag",
  ]) {
    const msg = acceptInvitationErrorMessage(new ApiError(422, raw))
    assert.equal(msg, GENERIC)
  }
})

test("activation : 429 / 503 → messages de lib/error-message.ts", () => {
  assert.equal(
    acceptInvitationErrorMessage(new ApiError(429, "trop de requêtes", 30)),
    "Trop de demandes en ce moment, réessayez dans 30 s.",
  )
  assert.equal(
    acceptInvitationErrorMessage(new ApiError(503, "Service Unavailable")),
    "Service momentanément indisponible, réessayez.",
  )
})

test("activation : 400, 500, erreur réseau → message générique ; 409 conservé", () => {
  assert.equal(acceptInvitationErrorMessage(new ApiError(400, "body JSON invalide")), GENERIC)
  assert.equal(acceptInvitationErrorMessage(new ApiError(500, "erreur lors de l'activation du compte")), GENERIC)
  assert.equal(acceptInvitationErrorMessage(new TypeError("Failed to fetch")), GENERIC)
  assert.equal(acceptInvitationErrorMessage(new ApiError(409, "conflit")), "Ce compte a déjà été activé.")
})
