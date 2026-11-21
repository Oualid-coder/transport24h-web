import { ApiError } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"

// Envoi des documents partenaires (POST /partners/{id}/documents/{doc_type}, en-tête X-Upload-Token).
// L'API répond 401 sans jeton et 403 pour un jeton faux, expiré ou remplacé par un renvoi
// (même réponse pour une candidature inconnue).

export const PARTNER_LINK_INVALID_MESSAGE =
  "Ce lien n'est plus valide : demandez un nouveau lien à Transport24h."

// Lien inutilisable : afficher PARTNER_LINK_INVALID_MESSAGE et le moyen de contact.
export function isPartnerLinkInvalid(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403)
}

// Message affiché sous un document en erreur.
export function partnerUploadErrorMessage(err: unknown): string {
  if (isPartnerLinkInvalid(err)) return PARTNER_LINK_INVALID_MESSAGE
  // 415 : contenu du fichier différent du type déclaré (message de l'API, lisible)
  if (err instanceof ApiError && err.status === 415 && err.message) {
    return err.message.charAt(0).toUpperCase() + err.message.slice(1)
  }
  return errorMessage(err, "Erreur lors de l'envoi.")
}
