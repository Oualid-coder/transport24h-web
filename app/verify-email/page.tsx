"use client"

// Composant client : l'appel part du navigateur après chargement de la page, pas au rendu
// serveur. Les scanners de liens des messageries (GET sans JavaScript) ne consomment donc pas
// le jeton à usage unique. Appel via lib/api.ts → /api/proxy (même origine).
import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { verifyEmail } from "@/lib/api"
import { verifyEmailErrorMessage } from "@/lib/email-verification"
import { stripTokenFromAddressBar } from "@/lib/url-token"

type State = { kind: "pending" } | { kind: "success" } | { kind: "error"; message: string }

function SuccessView() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <CheckCircle2 className="mx-auto mb-4 size-12 text-primary" />
      <h1 className="text-2xl font-bold">Email vérifié !</h1>
      <p className="mt-2 text-muted-foreground">
        Votre adresse email a bien été confirmée. Vous pouvez maintenant
        réserver votre déménagement.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/dashboard" className={buttonVariants()}>
          Mon espace
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Se connecter
        </Link>
      </div>
    </div>
  )
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <XCircle className="mx-auto mb-4 size-12 text-destructive" />
      <h1 className="text-2xl font-bold">Vérification échouée</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Le lien est valable 24 h et ne sert qu&apos;une fois. Si vous avez déjà
        vérifié votre adresse, connectez-vous. Sinon, connectez-vous puis
        demandez un nouveau lien depuis la réservation.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/login" className={buttonVariants()}>
          Se connecter
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Mon espace
        </Link>
      </div>
    </div>
  )
}

function PendingView() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
      Vérification de votre adresse email…
    </div>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  // Jeton figé au premier rendu : il est ensuite retiré de l'URL (stripTokenFromAddressBar)
  const [token] = useState(() => searchParams.get("token") ?? "")
  const [state, setState] = useState<State>({ kind: "pending" })

  useEffect(() => {
    stripTokenFromAddressBar()
  }, [])
  // Jeton à usage unique : un seul appel par jeton, même si l'effet est rejoué (mode strict)
  const requested = useRef<string | null>(null)

  useEffect(() => {
    if (!token || requested.current === token) return
    requested.current = token
    verifyEmail(token)
      .then(() => setState({ kind: "success" }))
      .catch((err: unknown) => setState({ kind: "error", message: verifyEmailErrorMessage(err) }))
  }, [token])

  if (!token) {
    return <ErrorView message="Lien de vérification incomplet. Utilisez le lien reçu par email, sans le modifier." />
  }
  if (state.kind === "success") return <SuccessView />
  if (state.kind === "error") return <ErrorView message={state.message} />
  return <PendingView />
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<PendingView />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
