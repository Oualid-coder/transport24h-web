import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError } from "../lib/api"
import {
  canResendInvitation,
  canResendPartnerLink,
  formatRetryDelay,
  invitationResentMessage,
  partnerLinkResentMessage,
  resendErrorMessage,
} from "../lib/invitation-resend"

test("renvoi d'invitation : comptes non activés seulement (statuts réels de l'API)", () => {
  assert.equal(canResendInvitation("invited"), true)
  assert.equal(canResendInvitation("expired"), true)
  assert.equal(canResendInvitation("active"), false)
  assert.equal(canResendInvitation("not_invited"), false)
})

test("renvoi du lien : candidature en attente seulement", () => {
  assert.equal(canResendPartnerLink("pending"), true)
  assert.equal(canResendPartnerLink("approved"), false)
  assert.equal(canResendPartnerLink("rejected"), false)
})

test("délai lisible", () => {
  assert.equal(formatRetryDelay(0), "1 s")
  assert.equal(formatRetryDelay(45), "45 s")
  assert.equal(formatRetryDelay(59.2), "1 min")
  assert.equal(formatRetryDelay(60), "1 min")
  assert.equal(formatRetryDelay(91), "2 min")
  assert.equal(formatRetryDelay(300), "5 min")
  assert.equal(formatRetryDelay(3600), "1 h")
  assert.equal(formatRetryDelay(5400), "1 h 30 min")
  assert.equal(formatRetryDelay(82800), "23 h")
  assert.equal(formatRetryDelay(86399), "24 h")
})

test("429 → délai d'attente, avec ou sans Retry-After", () => {
  assert.equal(
    resendErrorMessage(new ApiError(429, "renvoi déjà effectué récemment : réessayez plus tard", 300), "repli"),
    "Renvoi déjà effectué récemment : réessayez dans 5 min.",
  )
  assert.equal(
    resendErrorMessage(new ApiError(429, "x", 25200), "repli"),
    "Renvoi déjà effectué récemment : réessayez dans 7 h.",
  )
  assert.equal(resendErrorMessage(new ApiError(429, "x", null), "repli"), "Renvoi déjà effectué récemment : réessayez plus tard.")
})

test("409 → message de l'API ; 404, 500, réseau → repli de l'écran", () => {
  assert.equal(
    resendErrorMessage(new ApiError(409, "le compte entreprise est déjà activé : aucune invitation à renvoyer"), "repli"),
    "Le compte entreprise est déjà activé : aucune invitation à renvoyer",
  )
  assert.equal(
    resendErrorMessage(new ApiError(409, "la candidature a déjà été traitée : aucun lien à renvoyer"), "repli"),
    "La candidature a déjà été traitée : aucun lien à renvoyer",
  )
  assert.equal(resendErrorMessage(new ApiError(404, "entreprise introuvable"), "repli"), "repli")
  assert.equal(resendErrorMessage(new ApiError(500, "erreur lors du renvoi de l'invitation"), "repli"), "repli")
  assert.equal(resendErrorMessage(new ApiError(503, ""), "repli"), "Service momentanément indisponible, réessayez.")
  assert.equal(resendErrorMessage(new Error("réseau"), "repli"), "repli")
})

test("confirmation : seulement l'adresse déjà affichée", () => {
  assert.equal(invitationResentMessage("contact@acme.fr"), "Invitation renvoyée à contact@acme.fr.")
  assert.equal(invitationResentMessage(""), "Invitation renvoyée.")
  assert.equal(partnerLinkResentMessage("jean@exemple.fr"), "Lien renvoyé à jean@exemple.fr.")
  assert.equal(partnerLinkResentMessage(""), "Lien renvoyé.")
})
