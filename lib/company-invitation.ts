import { ApiError } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"
import { formatRetryDelay } from "@/lib/invitation-resend"
import type { InviteCompanyBody } from "@/lib/types"

// Invitation du contact d'une entreprise par l'admin (POST /admin/companies/{id}/invite).
// Règles alignées sur l'API (inviteB2BUserRequest) : email, prénom et nom obligatoires,
// email ≤ 254 caractères au format de reEmail, prénom et nom ≤ 100 caractères (comptés en
// caractères Unicode, comme l'API). Ré-inviter un email non activé de la même entreprise :
// même limite que le renvoi (429 + Retry-After).

export const INVITE_EMAIL_MAX = 254
export const INVITE_NAME_MAX = 100

// Même expression que reEmail (internal/handler/auth.go de l'API)
const API_EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

export interface InviteFormValues {
  email: string
  firstName: string
  lastName: string
}

export type InviteFormErrors = Partial<Record<keyof InviteFormValues, string>>

// Longueur en points de code (runes Go), pas en unités UTF-16
function charCount(s: string): number {
  return [...s].length
}

export function validateInviteForm(values: InviteFormValues): InviteFormErrors {
  const errors: InviteFormErrors = {}
  const email = values.email.trim()
  const firstName = values.firstName.trim()
  const lastName = values.lastName.trim()

  if (!email) errors.email = "Email requis"
  else if (charCount(email) > INVITE_EMAIL_MAX) errors.email = `${INVITE_EMAIL_MAX} caractères maximum`
  else if (!API_EMAIL_REGEX.test(email)) errors.email = "Email invalide"

  if (!firstName) errors.firstName = "Prénom requis"
  else if (charCount(firstName) > INVITE_NAME_MAX) errors.firstName = `${INVITE_NAME_MAX} caractères maximum`

  if (!lastName) errors.lastName = "Nom requis"
  else if (charCount(lastName) > INVITE_NAME_MAX) errors.lastName = `${INVITE_NAME_MAX} caractères maximum`

  return errors
}

export function buildInviteBody(values: InviteFormValues): InviteCompanyBody {
  return {
    email: values.email.trim(),
    first_name: values.firstName.trim(),
    last_name: values.lastName.trim(),
  }
}

// 404 → entreprise disparue ; 429 de l'API → délai (ré-invitation sous la limite du renvoi) ;
// 422 de l'API → noms de champs traduits ; 409 (« cet email est déjà utilisé »), 503 → errorMessage ;
// sinon repli.
export function inviteErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) {
    return "Entreprise introuvable : rechargez la liste."
  }
  // 429 de la limite d'invitation (writeResendLimited de l'API) ; un 429 de la gateway garde son texte
  if (err instanceof ApiError && err.status === 429 && err.message.startsWith("renvoi déjà effectué")) {
    return err.retryAfter !== null && err.retryAfter > 0
      ? `Invitation déjà envoyée récemment : réessayez dans ${formatRetryDelay(err.retryAfter)}.`
      : "Invitation déjà envoyée récemment : réessayez plus tard."
  }
  if (err instanceof ApiError && err.status === 422) {
    const translated = err.message.replace(/\bfirst_name\b/g, "prénom").replace(/\blast_name\b/g, "nom")
    return errorMessage(new ApiError(422, translated), "Informations invalides.")
  }
  return errorMessage(err, "L'invitation n'a pas pu être envoyée.")
}

export function invitationSentMessage(email: string): string {
  return `Invitation envoyée à ${email}.`
}
