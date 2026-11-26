// Jetons à usage unique passés dans l'URL (vérification d'email, invitation entreprise) :
// on les retire de la barre d'adresse dès la lecture, pour qu'ils ne partent pas dans
// l'historique, ni dans l'URL de page envoyée par un traceur accepté (Google Ads).

// Retire `name` de la query d'une URL (chemin + query + hash), sans toucher au reste.
export function withoutQueryParam(url: string, name: string): string {
  const u = new URL(url, "http://local")
  u.searchParams.delete(name)
  return `${u.pathname}${u.search}${u.hash}`
}

// À appeler dans un effet client, après avoir mémorisé le jeton (useState).
export function stripTokenFromAddressBar(name = "token"): void {
  if (typeof window === "undefined") return
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const next = withoutQueryParam(current, name)
  if (next !== current) window.history.replaceState(null, "", next)
}

// Jeton passé dans le fragment (#token=…, lien d'envoi des documents partenaires) : jamais
// envoyé au serveur par le navigateur (absent des journaux et de l'en-tête Referer).
export function hashParam(hash: string, name: string): string | null {
  const v = new URLSearchParams(hash.replace(/^#/, "")).get(name)
  return v ? v : null
}

// Retire `name` du fragment d'une URL (chemin + query + hash), sans toucher au reste.
export function withoutHashParam(url: string, name: string): string {
  const u = new URL(url, "http://local")
  const params = new URLSearchParams(u.hash.replace(/^#/, ""))
  params.delete(name)
  const rest = params.toString()
  return `${u.pathname}${u.search}${rest ? `#${rest}` : ""}`
}

// À appeler dans un effet client, après avoir mémorisé le jeton (useState).
export function stripHashTokenFromAddressBar(name = "token"): void {
  if (typeof window === "undefined") return
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const next = withoutHashParam(current, name)
  if (next !== current) window.history.replaceState(null, "", next)
}

// Lecteur à usage unique : le premier appel lit (et retire) le jeton, les suivants renvoient la
// même valeur. React Strict Mode (next dev) rejoue les effets : sans cela, le second
// passage relirait un fragment déjà vidé et perdrait le jeton.
export function onceReader(read: () => string | null): () => string | null {
  let value: string | null | undefined
  return () => {
    if (value === undefined) value = read()
    return value
  }
}

type LocationLike = Pick<Location, "pathname" | "search" | "hash">
type HistoryLike = Pick<History, "replaceState">

// Lit le jeton du fragment (#token=…) PUIS le retire aussitôt de la barre d'adresse
// (history.replaceState, sans nouvelle entrée d'historique). Lien de réinitialisation du mot de
// passe : le jeton ne doit rester ni dans l'URL affichée, ni dans l'historique, ni dans l'URL de
// page lue par un traceur accepté. null si absent. Côté serveur : null, rien n'est touché.
export function takeHashToken(
  name = "token",
  loc: LocationLike | undefined = typeof window === "undefined" ? undefined : window.location,
  hist: HistoryLike | undefined = typeof window === "undefined" ? undefined : window.history,
): string | null {
  if (!loc || !hist) return null
  const token = hashParam(loc.hash, name)
  const current = `${loc.pathname}${loc.search}${loc.hash}`
  const next = withoutHashParam(current, name)
  if (next !== current) hist.replaceState(null, "", next)
  return token
}
