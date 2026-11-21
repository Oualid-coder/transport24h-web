import type { BookingStatus } from "@/lib/types"

// Seul l'admin affecte, change et retire le chauffeur d'une course (PUT et DELETE
// /admin/bookings/{id}/assign). Le chauffeur n'a aucun moyen de se désister en ligne.

// PUT …/assign accepte une course confirmed ou assigned : sur une course assigned,
// c'est un changement de chauffeur.
export function assignDriverLabel(status: BookingStatus): string {
  return status === "assigned" ? "Changer de chauffeur" : "Assigner un chauffeur"
}

// DELETE …/assign : seulement une course assigned (409 sinon) ; elle redevient confirmée sans chauffeur.
export function canUnassignDriver(status: BookingStatus): boolean {
  return status === "assigned"
}

// Texte de la confirmation. L'API prévient le chauffeur retiré par e-mail, sauf pour une
// course entreprise (même règle que le mail d'affectation).
export function unassignConfirmText(isB2B: boolean): string {
  const base = "La course redevient confirmée sans chauffeur, à réaffecter."
  return isB2B
    ? `${base} Course entreprise : le chauffeur retiré n'est pas prévenu par e-mail, prévenez-le vous-même.`
    : `${base} Le chauffeur retiré est prévenu par e-mail.`
}

// Espace chauffeur : affiché à la place d'un bouton de désistement, suivi du moyen de contact du site.
// Espace insécable avant « : » (pas de « : » seul en début de ligne).
export const DRIVER_WITHDRAWAL_MESSAGE = "Pour vous désister d'une course, contactez l'administrateur\u00a0:"
