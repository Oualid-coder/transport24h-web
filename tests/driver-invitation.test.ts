import { test } from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ApiError } from "../lib/api"
import {
  canResendInvitation,
  driverCreatedMessage,
  driverInvitationStatusLabel,
  invitationResentMessage,
  resendErrorMessage,
} from "../lib/invitation-resend"

const created = { id: "1", email: "jean@example.com", first_name: "Jean", last_name: "Dupont", created_at: "2026-11-27T10:00:00Z" }

test("création CDI : invitation envoyée → confirmation avec l'adresse et la durée du lien", () => {
  const msg = driverCreatedMessage({ ...created, invitation_sent: true })
  assert.equal(msg.sent, true)
  assert.equal(msg.text, "Invitation envoyée à jean@example.com. Le lien d'activation est valable 72 heures.")
})

test("création CDI : mail non parti (ou réponse sans invitation_sent) → renvoyer depuis la liste", () => {
  for (const c of [{ ...created, invitation_sent: false }, created]) {
    const msg = driverCreatedMessage(c)
    assert.equal(msg.sent, false)
    assert.match(msg.text, /Renvoyez-la depuis « Invitations en attente »/)
  }
})

test("invitation chauffeur : renvoi possible pour une invitation en cours ou expirée", () => {
  assert.equal(canResendInvitation("invited"), true)
  assert.equal(canResendInvitation("expired"), true)
  assert.equal(driverInvitationStatusLabel("invited"), "Invitation envoyée")
  assert.equal(driverInvitationStatusLabel("expired"), "Lien expiré")
  assert.equal(invitationResentMessage("jean@example.com"), "Invitation renvoyée à jean@example.com.")
})

test("renvoi chauffeur : 409 de l'API affiché, 429 → délai, 404/500 → repli", () => {
  const repli = "L'invitation n'a pas pu être renvoyée. Réessayez."
  assert.equal(
    resendErrorMessage(
      new ApiError(409, "le compte de ce chauffeur est déjà actif : aucune invitation à renvoyer (il peut choisir un nouveau mot de passe avec « Mot de passe oublié »)"),
      repli,
    ),
    "Le compte de ce chauffeur est déjà actif : aucune invitation à renvoyer (il peut choisir un nouveau mot de passe avec « Mot de passe oublié »)",
  )
  assert.equal(
    resendErrorMessage(new ApiError(409, "aucune invitation à renvoyer pour ce chauffeur (compte désactivé ou candidature refusée)"), repli),
    "Aucune invitation à renvoyer pour ce chauffeur (compte désactivé ou candidature refusée)",
  )
  assert.equal(
    resendErrorMessage(new ApiError(429, "renvoi déjà effectué récemment : réessayez plus tard", 241), repli),
    "Renvoi déjà effectué récemment : réessayez dans 5 min.",
  )
  assert.equal(resendErrorMessage(new ApiError(404, "chauffeur introuvable"), repli), repli)
  assert.equal(resendErrorMessage(new ApiError(500, "erreur lors du renvoi de l'invitation"), repli), repli)
})

// Plus aucun mot de passe temporaire affiché ni lu nulle part dans le site.
test("aucune trace du mot de passe temporaire dans le code du site", () => {
  const root = fileURLToPath(new URL("..", import.meta.url))
  const hits: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(name) && /temp_password|tempPassword/.test(readFileSync(p, "utf8"))) hits.push(p)
    }
  }
  for (const d of ["app", "components", "lib"]) walk(join(root, d))
  assert.deepEqual(hits, [])
})
