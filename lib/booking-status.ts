import type { BookingStatus } from "@/lib/types"

// Débit Stripe en cours : l'API refuse (409) annulation, remboursement, prix et adresse
// jusqu'à la fin du débit. Le front masque ou désactive ces actions en amont.
export function isChargeInProgress(status: BookingStatus): boolean {
  return status === "payment_processing"
}
