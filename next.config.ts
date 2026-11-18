import type { NextConfig } from "next"

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "https://api.transport24h.fr"

// Google Ads (conversions + Conversion Linker), chargé uniquement après consentement
// (lib/consent.ts). Domaines issus du guide CSP officiel de Google ; google.fr pour les visiteurs FR.
const googleAds = {
  script: "https://www.googletagmanager.com https://www.googleadservices.com https://www.google.com",
  img: "https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.fr",
  connect: "https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.fr https://ad.doubleclick.net",
  frame: "https://www.googletagmanager.com",
}

// Photos d'état des lieux affichées directement depuis Cloudflare R2 (URL présignée, bucket privé).
// L'identifiant de compte n'est pas connu du web : sous-domaines de r2.cloudflarestorage.com, HTTPS seul.
export const r2Images = "https://*.r2.cloudflarestorage.com"

export const csp = [
  "default-src 'self'",
  // Next.js App Router injecte des <script> inline pour le payload RSC — unsafe-inline requis sans nonce middleware
  `script-src 'self' 'unsafe-inline' https://js.stripe.com ${googleAds.script}`,
  // Tailwind génère des styles inline au runtime (CSS-in-JS via shadcn)
  "style-src 'self' 'unsafe-inline'",
  // next/image (data:), Leaflet map tiles (OpenStreetMap), photos d'état des lieux :
  // URLs présignées R2 (pkg/storage de l'API, minio-go sur <compte>.r2.cloudflarestorage.com)
  `img-src 'self' data: blob: https://*.tile.openstreetmap.org ${r2Images} ${googleAds.img}`,
  // Fonts servies localement par next/font — pas besoin de fonts.googleapis.com
  "font-src 'self'",
  // API backend + Stripe (paiement + fraud detection)
  `connect-src 'self' ${apiOrigin} https://api.stripe.com https://hooks.stripe.com https://nominatim.openstreetmap.org ${googleAds.connect}`,
  // Stripe Elements s'affiche dans un iframe
  `frame-src https://js.stripe.com ${googleAds.frame}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: csp },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
]

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
