"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { CheckCircle2, LayoutDashboard, Home } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

function ConfirmationContent() {
  const sp = useSearchParams()
  const id = sp.get("id") ?? ""
  const shortId = id.slice(0, 8).toUpperCase()

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Icône succès */}
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="size-10 text-emerald-500" />
        </div>

        <h1 className="text-2xl font-bold">Réservation confirmée !</h1>
        <p className="mt-2 text-muted-foreground">
          Votre demande a bien été enregistrée. Notre équipe vous contactera
          sous 2h pour confirmer les détails.
        </p>

        {shortId && (
          <div className="mt-6 rounded-xl border border-border/50 bg-card px-6 py-4">
            <p className="text-xs text-muted-foreground">Référence de réservation</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-primary">
              {shortId}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "default" })}
          >
            <LayoutDashboard className="mr-2 size-4" />
            Voir mes réservations
          </Link>
          <Link
            href="/"
            className={buttonVariants({ variant: "outline" })}
          >
            <Home className="mr-2 size-4" />
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmationContent />
    </Suspense>
  )
}
