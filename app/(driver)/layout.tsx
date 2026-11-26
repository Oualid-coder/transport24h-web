import Image from "next/image"
import Link from "next/link"
import { Home, KeyRound } from "lucide-react"
import { LogoutButton } from "@/components/logout-button"

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo-transport24h.png"
              alt="Transport24h"
              width={84}
              height={28}
              className="h-7 w-auto object-contain"
            />
            <span className="hidden text-sm font-semibold sm:inline">Transport24h</span>
            <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Chauffeur
            </span>
          </div>

          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link
              href="/driver/dashboard"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-foreground max-lg:min-h-11 max-sm:min-w-11 max-sm:justify-center"
            >
              <Home className="size-4" />
              <span className="max-sm:sr-only">Mes missions</span>
            </Link>
            <Link
              href="/driver/password"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-foreground max-lg:min-h-11 max-sm:min-w-11 max-sm:justify-center"
            >
              <KeyRound className="size-4" />
              <span className="max-sm:sr-only">Mot de passe</span>
            </Link>
            <LogoutButton className="w-auto px-3 py-2 max-lg:min-h-11 max-sm:min-w-11 max-sm:justify-center" labelClassName="max-sm:sr-only" />
          </nav>
        </div>
      </header>

      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
