import type { NextConfig } from "next"

// Content-Security-Policy : posée par proxy.ts avec un nonce par requête (lib/csp.ts, audit M8).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
]

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Les mails d'invitation entreprise envoyés avant le correctif de l'API pointaient vers
  // /auth/accept-invitation (route de l'API, 404 sur le site) : on redirige, jeton conservé.
  async redirects() {
    return [{ source: "/auth/accept-invitation", destination: "/accept-invitation", permanent: false }]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Réponses JSON de l'API relayées (ou erreurs) : aucune exécution possible même si un jour
        // du HTML passait par le proxy (la CSP à nonce de proxy.ts ne couvre pas /api/*).
        source: "/api/(.*)",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; sandbox" }],
      },
    ]
  },
}

export default nextConfig
