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
