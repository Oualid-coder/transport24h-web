import { ApiError } from "@/lib/api"

// Vérification d'email — contrat API (branche feat/email-verification-v2) :
// GET /auth/verify-email 200/400/422, POST /auth/resend-verification 200/429 (Retry-After),
// 403 sur POST /bookings, /payments/intent, /payments/setup-intent tant que l'email n'est pas vérifié.

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

// Seuls les 403 dont le message parle de l'email : « vérifiez votre email avant de réserver »
// (booking.go) et « vérifiez votre email avant de payer » (payment.go). Les autres 403
// (« ce booking ne vous appartient pas », rôle…) gardent leur message d'erreur normal.
export function isEmailNotVerifiedError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 403 &&
    normalize(err.message).includes("verifiez votre email")
  )
}

// Message d'échec de la page /verify-email selon l'erreur de l'appel.
export function verifyEmailErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return "Lien de vérification incomplet. Utilisez le lien reçu par email, sans le modifier."
    if (err.status === 422) return "Ce lien de vérification est invalide, a expiré ou a déjà été utilisé."
    // 502 : le proxy n'a pas joint l'API
    if (err.status === 502) return "Impossible de joindre le serveur. Vérifiez votre connexion puis rechargez la page."
    return "La vérification n'a pas pu aboutir. Réessayez dans quelques minutes."
  }
  return "Impossible de joindre le serveur. Vérifiez votre connexion puis rechargez la page."
}

export function formatDelay(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, seconds)} seconde${seconds > 1 ? "s" : ""}`
  if (seconds < 3600) {
    const min = Math.ceil(seconds / 60)
    return `${min} minute${min > 1 ? "s" : ""}`
  }
  const h = Math.ceil(seconds / 3600)
  return `${h} heure${h > 1 ? "s" : ""}`
}

// Message d'erreur du bouton « renvoyer l'email ».
export function resendErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return err.retryAfter !== null
        ? `Trop de demandes d'envoi. Réessayez dans ${formatDelay(err.retryAfter)}.`
        : "Trop de demandes d'envoi. Réessayez plus tard."
    }
    return err.message
  }
  return "Impossible de joindre le serveur. Réessayez."
}
