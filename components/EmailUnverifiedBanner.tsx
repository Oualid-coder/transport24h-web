"use client"

import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { CheckCircle2, Loader2, MailWarning } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resendVerification, ApiError } from "@/lib/api"
import { resendErrorMessage } from "@/lib/email-verification"

interface EmailUnverifiedBannerProps {
  // Affiché uniquement après un 403 « vérifiez votre email » de l'API : l'API n'expose
  // pas email_verified pour un utilisateur connecté (seulement dans la réponse d'inscription).
  visible: boolean
}

export function EmailUnverifiedBanner({ visible }: EmailUnverifiedBannerProps) {
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  // Secondes d'attente imposées par un 429 (Retry-After) ; bouton désactivé pendant ce délai
  const [cooldown, setCooldown] = useState<number | null>(null)

  useEffect(() => {
    if (cooldown === null) return
    const timer = setTimeout(() => setCooldown(null), cooldown * 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const mutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: () => setSent(true),
    onError: (err) => {
      setSendError(resendErrorMessage(err))
      if (err instanceof ApiError && err.status === 429 && err.retryAfter) {
        setCooldown(err.retryAfter)
      }
    },
  })

  if (!visible) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700"
    >
      <MailWarning className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1 space-y-2">
        <p>
          <strong>Votre adresse email n&apos;est pas encore vérifiée.</strong>{" "}
          Cliquez sur le lien que nous vous avons envoyé par email, puis
          réessayez.
        </p>
        {sent ? (
          <p className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="size-3.5" />
            Email renvoyé — vérifiez votre boîte de réception.
          </p>
        ) : (
          <div className="space-y-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-amber-500/40 text-amber-700 hover:border-amber-500/60 hover:bg-amber-500/10"
              disabled={mutation.isPending || cooldown !== null}
              onClick={() => {
                setSendError(null)
                mutation.mutate()
              }}
            >
              {mutation.isPending && (
                <Loader2 className="mr-1.5 size-3 animate-spin" />
              )}
              Renvoyer l&apos;email de vérification
            </Button>
            {sendError && (
              <p className="text-xs text-destructive">{sendError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
