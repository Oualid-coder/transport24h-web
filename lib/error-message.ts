import { ApiError, refreshErrorMessage } from "@/lib/api"

// Statuts dont l'API renvoie une phrase française prête à afficher (writeError) :
// 403 « cette course ne vous est pas assignée », 409 conflit d'état, 413 taille, 422 règle métier.
// 400 (« body JSON invalide », « id invalide ») et 5xx restent techniques : message de repli de l'écran.
const API_MESSAGE_STATUSES = new Set([403, 409, 413, 422])

// 429 (limite de la gateway ou du renouvellement de session) et 503 (service ou renouvellement
// indisponible) : même texte que lib/api.ts. null pour tout autre cas.
export function transientErrorMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null
  if (err.status === 429) return refreshErrorMessage({ kind: "rateLimited", retryAfter: err.retryAfter })
  if (err.status === 503) return refreshErrorMessage({ kind: "unavailable" })
  return null
}

// Message à afficher pour une erreur d'appel API : 429/503, sinon le message métier de l'API
// (première lettre en majuscule), sinon le repli propre à l'écran.
export function errorMessage(err: unknown, fallback: string): string {
  const transient = transientErrorMessage(err)
  if (transient) return transient
  if (err instanceof ApiError && API_MESSAGE_STATUSES.has(err.status)) {
    const msg = err.message.trim()
    if (msg) return msg.charAt(0).toUpperCase() + msg.slice(1)
  }
  return fallback
}
