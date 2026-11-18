import type { Metadata } from "next"
import { headers } from "next/headers"
import { CSPProvider } from "@base-ui/react/csp-provider"
import { Geist, Geist_Mono } from "next/font/google"
import { QueryProvider } from "@/components/providers/QueryProvider"
import { CookieConsent } from "@/components/CookieConsent"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Transport24h — Déménagement & livraison express",
  description:
    "Réservez un camion avec chauffeur en quelques clics. Déménagement, livraison encombrants, transport professionnel.",
  keywords: ["déménagement", "transport", "camion", "livraison express"],
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // CSP à nonce (proxy.ts) : lire l'en-tête rend chaque page à la requête, condition pour que
  // Next.js pose le nonce sur ses scripts (une page prérendue au build serait bloquée).
  // Base UI (Slider, Tabs) émet des <script> inline avant hydratation : il reçoit le même nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <CSPProvider nonce={nonce}>
          <QueryProvider>{children}</QueryProvider>
          {/* gtag.js n'est injecté qu'après consentement (voir lib/consent.ts) */}
          <CookieConsent />
        </CSPProvider>
      </body>
    </html>
  )
}
