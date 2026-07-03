import type { NextConfig } from "next"

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "https://api.transport24h.fr"

const csp = [
  "default-src 'self'",
  // Next.js App Router injecte des <script> inline pour le payload RSC — unsafe-inline requis sans nonce middleware
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
  // Tailwind génère des styles inline au runtime (CSS-in-JS via shadcn)
  "style-src 'self' 'unsafe-inline'",
  // next/image (data:), Leaflet map tiles (CARTO)
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
  // Fonts servies localement par next/font — pas besoin de fonts.googleapis.com
  "font-src 'self'",
  // API backend + Stripe (paiement + fraud detection)
  `connect-src 'self' ${apiOrigin} https://api.stripe.com https://hooks.stripe.com https://nominatim.openstreetmap.org`,
  // Stripe Elements s'affiche dans un iframe
  "frame-src https://js.stripe.com",
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
