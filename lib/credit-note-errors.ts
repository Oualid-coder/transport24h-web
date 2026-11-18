import { ApiError } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"

// Traduction des erreurs de POST /admin/credit-note-retries/{clé}/retry (page admin « Avoirs à émettre »).
export function retryErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "Plus rien à émettre pour ce remboursement."
      case 409:
        return "Vérification Stripe requise : constatez le remboursement dans Stripe, cochez la case puis réessayez."
      case 422:
        return "Aucune facture d'origine pour cette course : l'avoir ne peut pas être émis."
    }
  }
  return errorMessage(err, "L'avoir n'a pas pu être émis. Réessayez dans quelques instants.")
}
