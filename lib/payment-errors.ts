import { ApiError } from "@/lib/api"

// Traduction des erreurs de POST /payments/confirm-setup.
// 402 : carte refusée par la banque (l'API renvoie un message français prêt à afficher).
export function confirmSetupErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 402) {
      return err.message || "Votre carte a été refusée. Essayez avec une autre carte."
    }
    if (err.status === 404) {
      return "Réservation introuvable, ou elle n'est pas rattachée à votre compte."
    }
    if (err.status === 409) {
      return "Cette réservation ne peut plus être payée. Consultez son statut dans votre espace client."
    }
  }
  return "Votre carte n'a pas pu être enregistrée. Veuillez réessayer dans quelques instants."
}
