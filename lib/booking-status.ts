import type { Booking, BookingStatus } from "@/lib/types"

// Débit Stripe en cours : l'API refuse (409) annulation, remboursement, prix et adresse
// jusqu'à la fin du débit. Le front masque ou désactive ces actions en amont.
export function isChargeInProgress(status: BookingStatus): boolean {
  return status === "payment_processing"
}

const ADDRESS_MODIFIABLE_STATUSES = new Set<BookingStatus>([
  "awaiting_payment",
  "pending_review",
  "confirmed",
])

// Texte du 409 de l'API (PUT /bookings/{id}/address sur une course payée), affiché à la place
// du bouton quand price_locked l'annonce déjà.
export const ADDRESS_PAID_MESSAGE =
  "Votre course est déjà payée : contactez-nous pour modifier l'adresse."

// Modification d'adresse côté client : "edit" → bouton, "paid" → ADDRESS_PAID_MESSAGE et contact,
// "none" → rien (statut non modifiable ou course passée). price_locked (domain.IsPriceLocked
// de l'API) absent (ancienne API) → comportement précédent : bouton, l'API tranche (409).
export function addressEditAction(
  booking: Pick<Booking, "status" | "scheduled_at" | "price_locked">,
  now: Date = new Date(),
): "edit" | "paid" | "none" {
  if (!ADDRESS_MODIFIABLE_STATUSES.has(booking.status) || !(new Date(booking.scheduled_at) > now)) {
    return "none"
  }
  return booking.price_locked === true ? "paid" : "edit"
}
