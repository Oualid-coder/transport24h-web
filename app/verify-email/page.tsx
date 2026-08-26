import Link from "next/link"
import { CheckCircle2, XCircle } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { ApiError } from "@/lib/api"

async function verifyToken(token: string): Promise<void> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string
    }
    throw new ApiError(
      res.status,
      body.error ?? body.message ?? res.statusText,
    )
  }
}

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
        <Link href="/booking" className={buttonVariants()}>
          Faire une réservation
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Mon espace
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
        Ce lien est valide 24h. Connectez-vous pour en demander un nouveau.
      </p>
      <Link href="/login" className={buttonVariants({ className: "mt-8" })}>
        Se connecter
      </Link>
    </div>
  )
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <ErrorView message="Lien de vérification invalide ou incomplet." />
  }

  let errorMessage: string | null = null
  try {
    await verifyToken(token)
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Lien invalide ou expiré."
  }

  if (errorMessage) {
    return <ErrorView message={errorMessage} />
  }
  return <SuccessView />
}
