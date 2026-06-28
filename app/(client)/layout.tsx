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
            <span className="text-base font-semibold tracking-tight">
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

          <NavActions isLoggedIn={isLoggedIn} />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
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
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Transport24h — Tous droits réservés
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <Link
                href="/partners"
                className="hover:text-foreground transition-colors"
              >
                Devenir partenaire
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
