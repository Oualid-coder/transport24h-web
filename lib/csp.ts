// Content-Security-Policy par requête (audit M8), posée par proxy.ts.
// Guide suivi : node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "https://api.transport24h.fr"

// Google Ads (conversions + Conversion Linker), chargé uniquement après consentement
// (lib/consent.ts). Domaines issus du guide CSP officiel de Google ; google.fr pour les visiteurs FR.
// Plus de liste de scripts : avec 'strict-dynamic', gtag.js (créé par lib/consent.ts) et Stripe.js
// (créé par loadStripe) héritent de la confiance du bundle porteur du nonce.
const googleAds = {
  img: "https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.fr",
  connect: "https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.fr https://ad.doubleclick.net",
  frame: "https://www.googletagmanager.com",
}

// Domaines de scripts pour les seuls navigateurs sans 'strict-dynamic' (ignorés sinon)
const scriptFallbackHosts =
  "https://js.stripe.com https://www.googletagmanager.com https://www.googleadservices.com https://www.google.com"

// Photos d'état des lieux affichées directement depuis Cloudflare R2 (URL présignée, bucket privé).
// L'identifiant de compte n'est pas connu du web : sous-domaines de r2.cloudflarestorage.com, HTTPS seul.
export const r2Images = "https://*.r2.cloudflarestorage.com"

// Nonce imprévisible et unique par requête (UUID v4 : 122 bits aléatoires), en base64.
export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64")
}

export function buildCsp(nonce: string, isDev = false): string {
  return [
    "default-src 'self'",
    // Next.js lit le nonce dans l'en-tête CSP de la requête et l'ajoute à ses propres scripts.
    // 'unsafe-eval' en développement seulement (traces d'erreur de React), jamais en production.
    // Repli pour les navigateurs sans 'strict-dynamic' (CSP2, ex. Safari < 15.4) : ils utilisent la
    // liste de domaines (Stripe, Google Ads) ; 'unsafe-inline' sert aux navigateurs CSP1 seulement.
    // Les navigateurs CSP3 IGNORENT ces deux valeurs dès qu'un nonce et 'strict-dynamic' sont présents.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' ${scriptFallbackHosts}${isDev ? " 'unsafe-eval'" : ""}`,
    // Leaflet et les composants posent des attributs style= : 'unsafe-inline' garde ici
    // (un nonce dans style-src ferait ignorer 'unsafe-inline' et bloquerait ces styles).
    "style-src 'self' 'unsafe-inline'",
    // next/image (data:), Leaflet map tiles (OpenStreetMap), photos d'état des lieux :
    // URLs présignées R2 (pkg/storage de l'API, minio-go sur <compte>.r2.cloudflarestorage.com)
    `img-src 'self' data: blob: https://*.tile.openstreetmap.org ${r2Images} ${googleAds.img}`,
    // Fonts servies localement par next/font — pas besoin de fonts.googleapis.com
    "font-src 'self'",
    // API backend + Stripe (paiement + fraud detection)
    `connect-src 'self' ${apiOrigin} https://api.stripe.com https://hooks.stripe.com https://nominatim.openstreetmap.org ${googleAds.connect}`,
    // Stripe Elements s'affiche dans un iframe
    // hooks.stripe.com : pages d'authentification forte (3D Secure) recommandées par Stripe
    `frame-src https://js.stripe.com https://hooks.stripe.com ${googleAds.frame}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ")
}
