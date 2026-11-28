import { ApiError } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"
import type { DriverCreated, DriverInvitation, InvitationStatus, PartnerStatus } from "@/lib/types"

// Renvoi par l'admin de l'invitation entreprise (POST /admin/companies/{id}/resend-invitation),
// de l'invitation chauffeur (POST /admin/drivers/{id}/resend-invitation)
// et du lien d'envoi des documents (POST /admin/partners/{id}/resend-link).
// L'API limite à 1 renvoi par 5 minutes et 5 par 24 h (429 + Retry-After).

// Compte entreprise non activé : invitation en cours ou expirée.
export function canResendInvitation(status: InvitationStatus): boolean {
  return status === "invited" || status === "expired"
}

// Candidature en attente seulement (l'API répond 409 sinon).
export function canResendPartnerLink(status: PartnerStatus): boolean {
  return status === "pending"
}

// Délai lisible : « 45 s », « 5 min », « 2 h », « 1 h 30 min » (arrondi à la minute supérieure au-delà d'une minute).
export function formatRetryDelay(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds))
  if (s < 60) return `${s} s`
  const totalMin = Math.ceil(s / 60)
  const h = Math.floor(totalMin / 60)
  const min = totalMin % 60
  if (h === 0) return `${min} min`
  return min === 0 ? `${h} h` : `${h} h ${min} min`
}

// 429 → délai d'attente ; 409 → message français de l'API (errorMessage) ; sinon repli de l'écran.
export function resendErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 429) {
    return err.retryAfter !== null && err.retryAfter > 0
      ? `Renvoi déjà effectué récemment : réessayez dans ${formatRetryDelay(err.retryAfter)}.`
      : "Renvoi déjà effectué récemment : réessayez plus tard."
  }
  return errorMessage(err, fallback)
}

// Confirmation : seulement l'adresse déjà affichée dans la ligne.
export function invitationResentMessage(email: string): string {
  return email ? `Invitation renvoyée à ${email}.` : "Invitation renvoyée."
}

export function partnerLinkResentMessage(email: string): string {
  return email ? `Lien renvoyé à ${email}.` : "Lien renvoyé."
}

// Création d'un chauffeur CDI : plus de mot de passe à transmettre, le chauffeur reçoit une
// invitation par e-mail. Mail non parti (invitation_sent absent ou faux) : à renvoyer.
export function driverCreatedMessage(created: DriverCreated): { sent: boolean; text: string } {
  return created.invitation_sent === true
    ? {
        sent: true,
        text: `Invitation envoyée à ${created.email}. Le lien d'activation est valable 72 heures.`,
      }
    : {
        sent: false,
        text: "Compte créé, mais l'invitation n'a pas pu être envoyée. Renvoyez-la depuis « Invitations en attente ».",
      }
}

// Statut d'une invitation chauffeur affiché dans l'admin.
export function driverInvitationStatusLabel(status: DriverInvitation["invitation_status"]): string {
  return status === "expired" ? "Lien expiré" : "Invitation envoyée"
}
