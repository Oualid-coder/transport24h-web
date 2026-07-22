import { cookies } from "next/headers"
import Image from "next/image"
import Link from "next/link"
import { NavActions } from "@/components/nav-actions"

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const isLoggedIn = !!cookieStore.get("access_token")?.value
  const role = cookieStore.get("user_role")?.value ?? null

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo-transport24h.png"
              alt="Transport24h"
              width={108}
              height={36}
              className="h-9 w-auto object-contain"
            />
            <span className="hidden sm:inline text-base font-semibold tracking-tight">
              Transport24h
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link
              href="/#devis"
              className="hover:text-foreground transition-colors"
            >
              Devis
            </Link>
            <Link
              href="/partners"
              className="hover:text-foreground transition-colors"
            >
              Devenir partenaire
            </Link>
          </nav>

          <NavActions isLoggedIn={isLoggedIn} role={role} />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-start">
            {/* Logo + identité */}
            <div className="flex items-center gap-2">
              <Image
                src="/logo-transport24h.png"
                alt=""
                width={64}
                height={20}
                className="h-5 w-auto object-contain"
                aria-hidden="true"
              />
              <span className="text-sm font-medium">Transport24h</span>
            </div>

            {/* Infos légales société */}
            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p>© {new Date().getFullYear()} TRANSPORT24H.FR — Tous droits réservés</p>
              <p>SAS au capital de 5 400 € · SIREN 992 485 623</p>
            </div>

            {/* Liens */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:justify-end">
              <Link href="/mentions-legales" className="hover:text-foreground transition-colors">
                Mentions légales
              </Link>
              <Link href="/cgv" className="hover:text-foreground transition-colors">
                CGV
              </Link>
              <Link href="/politique-de-confidentialite" className="hover:text-foreground transition-colors">
                Confidentialité
              </Link>
              <Link href="/partners" className="hover:text-foreground transition-colors">
                Devenir partenaire
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
