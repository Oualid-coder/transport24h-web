// Redirection après connexion / inscription : seuls les chemins internes du site sont acceptés.
// Refusés : "//hôte", "/\hôte", URL absolues, caractères de contrôle (tabulation, retour ligne
// que les navigateurs suppriment), et tout chemin qui, une fois normalisé, sortirait de l'origine
// ou commencerait par "//" (ex. "/..//hôte").
const BASE = "https://base.invalid"

export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null
  if (!value.startsWith("/") || value.startsWith("//")) return null
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return null

  let url: URL
  try {
    url = new URL(value, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null
  const path = url.pathname + url.search + url.hash
  return path.startsWith("/") && !path.startsWith("//") ? path : null
}
