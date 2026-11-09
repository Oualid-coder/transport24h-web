"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, FileCheck2, Loader2, Receipt, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCreditNoteRetries, retryCreditNote, ApiError } from "@/lib/api"
import type { CreditNoteRetry, CreditNoteRetryReason, CreditNoteRetryResult } from "@/lib/types"
import { BackButton } from "@/components/BackButton"

const QUERY_KEY = ["admin-credit-note-retries"]

// ── Motif du drapeau ──────────────────────────────────────────────────────────

const REASON_CONFIG: Record<CreditNoteRetryReason, { label: string; className: string }> = {
  avoir_failed: {
    label: "Avoir non émis",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  refund_ambiguous: {
    label: "Remboursement à vérifier dans Stripe",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
}

const fmtEuros = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })

// ── Messages de réponse du réessai ────────────────────────────────────────────

function retrySuccessMessage(result: CreditNoteRetryResult): string {
  return result.created
    ? `Avoir ${result.credit_note_number} émis et envoyé au client.`
    : `Avoir ${result.credit_note_number} déjà émis : rien n'a été renvoyé.`
}

function retryErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "Plus rien à émettre pour ce remboursement."
      case 409:
        return "Vérification Stripe requise : constatez le remboursement dans Stripe, cochez la case puis réessayez."
      case 422:
        return "Aucune facture d'origine pour cette course : l'avoir ne peut pas être émis."
    }
  }
  return "L'avoir n'a pas pu être émis. Réessayez dans quelques instants."
}

// ── Toast simple ──────────────────────────────────────────────────────────────

interface Toast {
  id: number
  type: "success" | "error"
  message: string
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      6000,
    )
  }, [])

  return { toasts, push }
}

// ── Ligne du tableau ──────────────────────────────────────────────────────────

function RetryRow({
  retry,
  pending,
  onRetry,
}: {
  retry: CreditNoteRetry
  pending: boolean
  onRetry: (refundKey: string, confirmedInStripe: boolean) => void
}) {
  const [stripeChecked, setStripeChecked] = useState(false)
  const needsStripeCheck = retry.reason === "refund_ambiguous"
  const reason = REASON_CONFIG[retry.reason] ?? {
    label: retry.reason,
    className: "border-border bg-muted text-muted-foreground",
  }
  const checkboxId = `stripe-check-${retry.refund_key}`

  return (
    <tr className="border-b border-border/50 align-top transition-colors hover:bg-accent/30">
      <td className="py-3 pr-4">
        <span className="font-mono text-xs" title={retry.booking_id}>
          #{retry.booking_id.slice(0, 8).toUpperCase()}
        </span>
      </td>
      <td className="py-3 pr-4">
        <span className="break-all font-mono text-xs text-muted-foreground">
          {retry.refund_key}
        </span>
      </td>
      <td className="py-3 pr-4">
        <span className="break-all font-mono text-xs text-muted-foreground">
          {retry.stripe_refund_id || "—"}
        </span>
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-sm font-medium tabular-nums">
        {fmtEuros(retry.amount_cents)}
      </td>
      <td className="py-3 pr-4">
        <Badge className={reason.className}>{reason.label}</Badge>
      </td>
      <td className="max-w-56 py-3 pr-4">
        <p className="line-clamp-3 text-xs text-muted-foreground" title={retry.last_error}>
          {retry.last_error || "—"}
        </p>
      </td>
      <td className="py-3 pr-4 text-sm tabular-nums">{retry.attempts}</td>
      <td className="whitespace-nowrap py-3 pr-4 text-xs text-muted-foreground">
        {fmtDate(retry.created_at)}
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-xs text-muted-foreground">
        {fmtDate(retry.updated_at)}
      </td>
      <td className="min-w-52 py-3">
        <div className="space-y-2">
          {needsStripeCheck && (
            <label htmlFor={checkboxId} className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                id={checkboxId}
                type="checkbox"
                checked={stripeChecked}
                disabled={pending}
                onChange={(e) => setStripeChecked(e.target.checked)}
                className="mt-0.5 shrink-0 accent-primary"
              />
              <span>J&apos;ai vérifié dans Stripe que le remboursement a eu lieu</span>
            </label>
          )}
          {(!needsStripeCheck || stripeChecked) && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2.5 text-xs"
              disabled={pending}
              onClick={() => onRetry(retry.refund_key, needsStripeCheck)}
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Réémettre l&apos;avoir
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const COLUMNS = [
  "Réservation",
  "Clé de remboursement",
  "Remboursement Stripe",
  "Montant",
  "Motif",
  "Dernière erreur",
  "Tentatives",
  "Créé le",
  "Mis à jour le",
  "Action",
]

export default function CreditNotesPage() {
  const queryClient = useQueryClient()
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const { toasts, push: pushToast } = useToast()

  const {
    data: retries = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getCreditNoteRetries,
    staleTime: 30_000,
  })

  const retryMutation = useMutation({
    mutationFn: ({ refundKey, confirmed }: { refundKey: string; confirmed: boolean }) =>
      retryCreditNote(refundKey, confirmed),
    onSuccess: (result) => pushToast("success", retrySuccessMessage(result)),
    onError: (err) => pushToast("error", retryErrorMessage(err)),
    onSettled: () => {
      setPendingKey(null)
      // Rafraîchit dans tous les cas : le drapeau a pu être résolu ou requalifié côté serveur.
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  const handleRetry = (refundKey: string, confirmedInStripe: boolean) => {
    setPendingKey(refundKey)
    retryMutation.mutate({ refundKey, confirmed: confirmedInStripe })
  }

  return (
    <div className="space-y-6">
      <BackButton href="/admin/dashboard" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Avoirs à émettre</h1>
          <p className="mt-1 text-muted-foreground">
            {isLoading
              ? "Chargement…"
              : isError
                ? "Liste indisponible"
                : `${retries.length} avoir${retries.length > 1 ? "s" : ""} en attente`}
          </p>
        </div>
        <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Actualiser
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          Impossible de charger les avoirs à émettre. Réessayez avec « Actualiser ».
        </div>
      ) : retries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <FileCheck2 className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">Aucun avoir en attente</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent/40">
                {COLUMNS.map((label) => (
                  <th
                    key={label}
                    className="whitespace-nowrap py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground first:pl-0"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {retries.map((r) => (
                <RetryRow
                  key={r.refund_key}
                  retry={r}
                  pending={pendingKey === r.refund_key}
                  onRetry={handleRetry}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Receipt className="size-3.5" />
        Un remboursement « à vérifier dans Stripe » ne peut être régularisé qu&apos;après
        avoir constaté dans Stripe que le remboursement a bien eu lieu.
      </p>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
              t.type === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-primary/30 bg-primary/10 text-primary"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
