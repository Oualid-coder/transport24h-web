import { ApiError, parseRetryAfter } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"
import { safeRedirectPath } from "@/lib/safe-redirect"

// Chargement d'une liste (tableaux de bord) : une erreur de l'API ne doit jamais s'afficher comme une
// liste vide. Seule une réponse 200 avec un tableau donne « ok » (éventuellement vide).

export const UNAVAILABLE_MESSAGE = "Service momentanément indisponible, réessayez."
export const NOT_FOUND_MESSAGE = "Liste introuvable : le service n'est peut-être pas encore à jour. Réessayez plus tard."
export const FORBIDDEN_MESSAGE = "Accès refusé : cette liste n'est pas disponible pour votre compte."

// Délai maximal d'un appel serveur (Server Component) : au-delà, état « indisponible »
export const SERVER_FETCH_TIMEOUT_MS = 10_000

// Message d'une erreur de chargement de liste.
// 502/503/504, réseau, délai dépassé → indisponible (avec le délai de Retry-After s'il est connu) ;
// 404 → liste introuvable ; 403 → message de l'API ou de rôle (errorMessage), sinon accès refusé ;
// 429 et le reste → errorMessage avec le repli de l'écran.
export function loadErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return UNAVAILABLE_MESSAGE
  if (err.status === 502 || err.status === 503 || err.status === 504) {
    return err.retryAfter !== null && err.retryAfter > 0
      ? `Service momentanément indisponible, réessayez dans ${err.retryAfter} s.`
      : UNAVAILABLE_MESSAGE
  }
  if (err.status === 404) return NOT_FOUND_MESSAGE
  if (err.status === 403) return errorMessage(err, FORBIDDEN_MESSAGE)
  return errorMessage(err, fallback)
}

// « Réessayer » proposé sauf sur 403 (un nouvel essai donnerait la même réponse)
export function canRetryLoad(err: unknown): boolean {
  return !(err instanceof ApiError && err.status === 403)
}

// Session expirée ou révoquée vue côté serveur : /session tente le renouvellement (le Server Component
// ne peut pas poser de cookie), puis revient à la page d'origine ou envoie vers /login.
export function sessionRedirectUrl(path: string): string {
  const safe = safeRedirectPath(path)
  return safe ? `/session?redirect=${encodeURIComponent(safe)}` : "/session"
}

export type ListLoad<T> =
  | { kind: "ok"; items: T[] }
  | { kind: "session" }
  | { kind: "error"; message: string; retryable: boolean }

function loadError<T>(err: unknown, fallback: string): ListLoad<T> {
  return { kind: "error", message: loadErrorMessage(err, fallback), retryable: canRetryLoad(err) }
}

// GET d'une liste depuis un Server Component (appel direct à l'API, en-têtes fournis par l'appelant).
// 401 → « session » ; autre statut non 2xx, réseau, délai, corps illisible ou non tableau → « error ».
export async function loadServerList<T>(
  url: string,
  headers: Record<string, string>,
  fallback: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = SERVER_FETCH_TIMEOUT_MS,
): Promise<ListLoad<T>> {
  let res: Response
  try {
    res = await fetchImpl(url, { headers, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    return loadError(err, fallback)
  }
  if (res.status === 401) return { kind: "session" }
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string; message?: string }
      if (body.error) message = body.error
      else if (body.message) message = body.message
    } catch {
      // corps absent ou non JSON : statusText
    }
    return loadError(new ApiError(res.status, message, parseRetryAfter(res.headers.get("retry-after"))), fallback)
  }
  let data: unknown
  try {
    data = await res.json()
  } catch (err) {
    return loadError(err, fallback)
  }
  if (!Array.isArray(data)) return loadError(new ApiError(502, "réponse hors contrat"), fallback)
  // Éléments non validés un à un, comme avant (contrat de l'API) : seul le tableau est vérifié
  return { kind: "ok", items: data as T[] }
}
