import { ApiError } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"
import type {
  StripeActivationResult,
  StripeReconciliationRow,
  StripeRefundCreditNoteResult,
  StripeRefundSettings,
} from "@/lib/types"

// Page admin « Rapprochement Stripe » : remboursements Stripe sans avoir, émission de l'avoir en deux
// étapes (vérification dans Stripe cochée, puis confirmation explicite), activation des avoirs
// automatiques (deux étapes, une seule fois).

// Périodes proposées (jours) ; l'API accepte 1 à 400 jours et lit au plus 300 remboursements.
export const RECONCILIATION_PERIODS = [30, 90, 180, 365] as const
export const DEFAULT_RECONCILIATION_DAYS = 90

export const formatRefundCents = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })

const STATUS_LABEL: Record<string, string> = {
  succeeded: "Réussi",
  pending: "En attente",
  requires_action: "Action requise",
  failed: "Échoué",
  canceled: "Annulé",
}

export function refundStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}

export function originLabel(row: Pick<StripeReconciliationRow, "origin">): string {
  switch (row.origin) {
    case "app":
      return "Application"
    case "external":
      return "Hors application"
    default:
      return "Inconnue (non suivie)"
  }
}

// Texte d'état des avoirs automatiques, selon que la date de mise en service est posée ou non.
export function autoCreditNotesStatus(settings: Pick<StripeRefundSettings, "cutoff_at">): string {
  return settings.cutoff_at
    ? `Avoirs automatiques actifs depuis le ${fmtDateTime(settings.cutoff_at)} : les remboursements faits dans Stripe après cette date et réussis reçoivent leur avoir automatiquement. Ceux d'avant se traitent ici, un par un.`
    : "Avoirs automatiques non activés : aucun remboursement fait dans Stripe ne reçoit d'avoir automatiquement. Activez-les une fois les événements Stripe activés, puis traitez ici les remboursements passés."
}

export const ACTIVATION_QUESTION =
  "Activer les avoirs automatiques maintenant ? À partir de cet instant, chaque remboursement fait dans Stripe hors de l'application et réussi recevra automatiquement son avoir, envoyé au client. La date de mise en service ne pourra plus être déplacée."

export function activationSuccessMessage(result: StripeActivationResult): string {
  const when = result.settings.cutoff_at ? fmtDateTime(result.settings.cutoff_at) : ""
  return result.activated
    ? `Avoirs automatiques activés (mise en service : ${when}).`
    : `Avoirs automatiques déjà actifs depuis le ${when} : rien n'a changé.`
}

// Question de la seconde étape : montant, identifiant, course, montant ajouté au total remboursé, et
// mise en garde pour un remboursement antérieur à la mise en service.
export function issueConfirmationQuestion(
  row: Pick<StripeReconciliationRow, "amount_cents" | "stripe_refund_id" | "booking_reference" | "before_cutoff" | "count_cents">,
): string {
  const course = row.booking_reference ? ` sur la course ${row.booking_reference}` : ""
  const counted =
    row.count_cents > 0
      ? ` ${formatRefundCents(row.count_cents)} seront ajoutés au total remboursé de la course.`
      : " Le total remboursé de la course ne change pas (ce montant y figure déjà)."
  const base = `Émettre un avoir de ${formatRefundCents(row.amount_cents)} pour le remboursement ${row.stripe_refund_id}${course} ? L'avoir sera envoyé au client et ne pourra pas être modifié.${counted}`
  return row.before_cutoff
    ? `${base} Remboursement antérieur à la mise en service : vérifiez qu'aucun avoir n'a déjà été émis pour lui.`
    : base
}

export function issueSuccessMessage(result: StripeRefundCreditNoteResult): string {
  return result.created
    ? `Avoir ${result.credit_note_number} émis et envoyé au client.`
    : `Avoir ${result.credit_note_number} déjà émis : rien n'a été renvoyé.`
}

// 404 et 502 traduits ici ; 409 et 422 : phrase française de l'API ; sinon repli.
export function issueErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) {
    return "Remboursement introuvable dans Stripe : actualisez la liste."
  }
  if (err instanceof ApiError && err.status === 502) {
    return "Stripe ne répond pas : rien n'a été émis. Réessayez dans quelques instants."
  }
  return errorMessage(err, "L'avoir n'a pas pu être émis. Actualisez la liste avant de réessayer.")
}

export function activationErrorMessage(err: unknown): string {
  return errorMessage(err, "L'activation n'a pas pu être enregistrée. Actualisez la page avant de réessayer.")
}

export function listErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 502) {
    return "Stripe ne répond pas : impossible de lire les remboursements. Réessayez avec « Actualiser »."
  }
  return errorMessage(err, "Impossible de lire les remboursements Stripe. Réessayez avec « Actualiser ».")
}
