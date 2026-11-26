"use client"

// Encadré d'erreur d'une liste qui n'a pas pu être chargée (jamais « Aucun… » à la place) :
// message, et bouton « Réessayer » si un nouvel essai a un sens.
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LoadError({
  title,
  message,
  onRetry,
  retrying = false,
}: {
  title?: string
  message: string
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        {title && <p className="font-medium">{title}</p>}
        <p>{message}</p>
        {onRetry && (
          <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
            {retrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Réessayer
          </Button>
        )}
      </div>
    </div>
  )
}

// Variante pour une page rendue côté serveur : « Réessayer » relance le rendu serveur (router.refresh)
export function RefreshLoadError({
  title,
  message,
  retryable,
}: {
  title?: string
  message: string
  retryable: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <LoadError
      title={title}
      message={message}
      retrying={pending}
      onRetry={retryable ? () => startTransition(() => router.refresh()) : undefined}
    />
  )
}
