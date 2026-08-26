"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { CheckCircle2, Loader2, MailWarning } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resendVerification, ApiError } from "@/lib/api"

interface EmailUnverifiedBannerProps {
  // Si fourni, pilote l'affichage directement (booking/payment).
  // Si absent, le composant lit sessionStorage (dashboard).
  visible?: boolean
}

export function EmailUnverifiedBanner({ visible }: EmailUnverifiedBannerProps) {
  const [fromStorage] = useState(
    () => typeof window !== "undefined" && !!sessionStorage.getItem("email_unverified"),
  )
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: () => setSent(true),
    onError: (err) => {
      setSendError(err instanceof ApiError ? err.message : "Erreur lors de l'envoi.")
    },
  })

  const show = visible !== undefined ? visible : fromStorage
  if (!show) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
      <MailWarning className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1 space-y-2">
        <p>
          <strong>Votre adresse email n&apos;est pas encore vérifiée.</strong>{" "}
          Vérifiez votre boîte de réception et cliquez sur le lien que nous
          vous avons envoyé.
        </p>
        {sent ? (
          <p className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="size-3.5" />
            Email renvoyé — vérifiez votre boîte de réception.
          </p>
        ) : (
          <div className="space-y-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-amber-500/40 text-amber-700 hover:border-amber-500/60 hover:bg-amber-500/10"
              disabled={mutation.isPending}
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
