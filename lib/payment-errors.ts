import { ApiError } from "@/lib/api"
import { transientErrorMessage } from "@/lib/error-message"

// Traduction des erreurs de POST /payments/confirm-setup.
// 402 : carte refusée par la banque (l'API renvoie un message français prêt à afficher).
// 429 / 503 : surcharge ou indisponibilité passagère (aucun autre message brut de l'API).
export function confirmSetupErrorMessage(err: unknown): string {
  const transient = transientErrorMessage(err)
  if (transient) return transient
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
