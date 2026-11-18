// Garde-fous des Route Handlers qui parlent à l'API (audit F11).

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// Requête modifiante (POST, PUT, PATCH, DELETE) envoyée depuis une autre origine : à refuser.
// Comparaison de l'hôte de `Origin` avec l'hôte de la requête (`x-forwarded-host`, sinon `Host`), comme
// le contrôle CSRF des Server Actions de Next. Lors d'une attaque CSRF, c'est le navigateur de la victime
// qui pose `Host` et `Origin` : le site tiers ne contrôle ni l'un ni l'autre, et ne peut pas ajouter
// `x-forwarded-host` sans pré-vérification CORS (refusée : aucune en-tête CORS ici). Pas de liste à tenir à
// jour (apex, www, local). `Origin` absent (client non navigateur, anciens navigateurs) : accepté.
export function isCrossOriginMutation(req: Request): boolean {
  if (SAFE_METHODS.has(req.method)) return false
  const origin = req.headers.get("origin")
  if (origin === null) return false
  const host = (req.headers.get("x-forwarded-host")?.split(",")[0] ?? req.headers.get("host"))
    ?.trim()
    .toLowerCase()
  if (!host) return true
  try {
    return new URL(origin).host.toLowerCase() !== host
  } catch {
    return true // "null" (iframe sandbox, redirection) ou valeur illisible
  }
}

// Corps JSON exigé (login) : un formulaire inter-sites ne peut envoyer que text/plain, urlencoded ou multipart.
export function isJsonContentType(req: Request): boolean {
  const ct = req.headers.get("content-type")
  return ct !== null && ct.split(";")[0].trim().toLowerCase() === "application/json"
}

// Chemin du proxy : chaque segment (décodé par Next) est ré-encodé ; ".", ".." et segment vide refusés.
export function proxyPath(segments: string[]): string | null {
  if (segments.some((s) => s === "" || s === "." || s === "..")) return null
  return segments.map(encodeURIComponent).join("/")
}
