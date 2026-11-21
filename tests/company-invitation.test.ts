import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError } from "../lib/api"
import {
  INVITE_EMAIL_MAX,
  INVITE_NAME_MAX,
  buildInviteBody,
  invitationSentMessage,
  inviteErrorMessage,
  validateInviteForm,
} from "../lib/company-invitation"

const ok = { email: "karim@garage.fr", firstName: "Karim", lastName: "Benali" }

test("bornes alignées sur l'API : email 254, prénom et nom 100", () => {
  assert.equal(INVITE_EMAIL_MAX, 254)
  assert.equal(INVITE_NAME_MAX, 100)
})

test("formulaire valide : aucune erreur", () => {
  assert.deepEqual(validateInviteForm(ok), {})
  // Espaces autour retirés avant validation
  assert.deepEqual(validateInviteForm({ email: "  karim@garage.fr ", firstName: " Karim ", lastName: "Benali " }), {})
})

test("champs obligatoires (espaces seuls refusés)", () => {
  assert.deepEqual(validateInviteForm({ email: "", firstName: " ", lastName: "" }), {
    email: "Email requis",
    firstName: "Prénom requis",
    lastName: "Nom requis",
  })
})

test("email : même format que reEmail de l'API", () => {
  for (const bad of ["karim", "karim@garage", "karim@garage.f", "ka rim@garage.fr", "karim@ga_rage.fr", "kärim@garage.fr"]) {
    assert.equal(validateInviteForm({ ...ok, email: bad }).email, "Email invalide", bad)
  }
  for (const good of ["k.benali+b2b@garage-ahmed.co.uk", "K_B%1@sub.garage.fr"]) {
    assert.equal(validateInviteForm({ ...ok, email: good }).email, undefined, good)
  }
})

test("longueurs exactes : limite acceptée, limite + 1 refusée", () => {
  const domain = "@garage.fr"
  const email254 = "a".repeat(254 - domain.length) + domain
  assert.equal(validateInviteForm({ ...ok, email: email254 }).email, undefined)
  assert.equal(validateInviteForm({ ...ok, email: "a" + email254 }).email, "254 caractères maximum")

  // Comptées en caractères (runes côté API), pas en unités UTF-16 : 100 « 𝒜 » = 200 unités
  const name100 = "𝒜".repeat(100)
  assert.equal(name100.length, 200)
  assert.deepEqual(validateInviteForm({ ...ok, firstName: name100, lastName: "é".repeat(100) }), {})
  assert.equal(validateInviteForm({ ...ok, firstName: name100 + "x" }).firstName, "100 caractères maximum")
  assert.equal(validateInviteForm({ ...ok, lastName: "é".repeat(101) }).lastName, "100 caractères maximum")
})

test("corps envoyé : noms de champs de l'API, valeurs nettoyées", () => {
  assert.deepEqual(buildInviteBody({ email: " karim@garage.fr ", firstName: " Karim", lastName: "Benali " }), {
    email: "karim@garage.fr",
    first_name: "Karim",
    last_name: "Benali",
  })
})

test("erreurs de l'API", () => {
  assert.equal(inviteErrorMessage(new ApiError(409, "cet email est déjà utilisé")), "Cet email est déjà utilisé")
  assert.equal(inviteErrorMessage(new ApiError(404, "entreprise introuvable")), "Entreprise introuvable : rechargez la liste.")
  assert.equal(
    inviteErrorMessage(new ApiError(422, "le champ first_name ne doit pas dépasser 100 caractères")),
    "Le champ prénom ne doit pas dépasser 100 caractères",
  )
  assert.equal(
    inviteErrorMessage(new ApiError(422, "email, first_name et last_name sont obligatoires")),
    "Email, prénom et nom sont obligatoires",
  )
  assert.equal(inviteErrorMessage(new ApiError(422, "format d'email invalide")), "Format d'email invalide")
  // Ré-invitation sous la limite du renvoi (message de writeResendLimited + Retry-After)
  assert.equal(
    inviteErrorMessage(new ApiError(429, "renvoi déjà effectué récemment : réessayez plus tard", 240)),
    "Invitation déjà envoyée récemment : réessayez dans 4 min.",
  )
  assert.equal(
    inviteErrorMessage(new ApiError(429, "renvoi déjà effectué récemment : réessayez plus tard", null)),
    "Invitation déjà envoyée récemment : réessayez plus tard.",
  )
  // 429 de la gateway : message générique de errorMessage
  assert.equal(
    inviteErrorMessage(new ApiError(429, "trop de requêtes", 12)),
    "Trop de demandes en ce moment, réessayez dans 12 s.",
  )
  assert.equal(inviteErrorMessage(new ApiError(400, "body JSON invalide")), "L'invitation n'a pas pu être envoyée.")
  assert.equal(inviteErrorMessage(new ApiError(500, "erreur lors de l'envoi de l'invitation")), "L'invitation n'a pas pu être envoyée.")
  assert.equal(inviteErrorMessage(new ApiError(503, "")), "Service momentanément indisponible, réessayez.")
  assert.equal(inviteErrorMessage(new Error("réseau")), "L'invitation n'a pas pu être envoyée.")
})

test("confirmation", () => {
  assert.equal(invitationSentMessage("karim@garage.fr"), "Invitation envoyée à karim@garage.fr.")
})
