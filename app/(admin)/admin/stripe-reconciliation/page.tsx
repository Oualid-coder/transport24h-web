"use client"

import { useCallback, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, FileCheck2, Loader2, Receipt, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BackButton } from "@/components/BackButton"
import { activateStripeAutoCreditNotes, getStripeReconciliation, issueStripeRefundCreditNote } from "@/lib/api"
import {
  ACTIVATION_QUESTION,
  DEFAULT_RECONCILIATION_DAYS,
  activationErrorMessage,
  activationSuccessMessage,
  autoCreditNotesStatus,
  RECONCILIATION_PERIODS,
  formatRefundCents,
  issueConfirmationQuestion,
  issueErrorMessage,
  issueSuccessMessage,
  listErrorMessage,
  originLabel,
  refundStatusLabel,
} from "@/lib/stripe-reconciliation"
import type { StripeReconciliationRow } from "@/lib/types"

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })

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
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000)
  }, [])
  return { toasts, push }
}

// ── Ligne : émission en deux étapes ──────────────────────────────────────────

type Step = "idle" | "check" | "confirm"

function RefundRow({
  row,
  pending,
  onIssue,
}: {
  row: StripeReconciliationRow
  pending: boolean
  onIssue: (refundId: string) => void
}) {
  const [step, setStep] = useState<Step>("idle")
  const [checked, setChecked] = useState(false)
  const checkboxId = `stripe-check-${row.stripe_refund_id}`

  const reset = () => {
    setStep("idle")
    setChecked(false)
  }

  return (
    <tr className="border-b border-border/50 align-top transition-colors hover:bg-accent/30">
      <td className="whitespace-nowrap py-3 pr-4 text-xs text-muted-foreground">{fmtDate(row.created)}</td>
      <td className="py-3 pr-4">
        <span className="break-all font-mono text-xs">{row.stripe_refund_id}</span>
        <span className="block break-all font-mono text-[11px] text-muted-foreground">{row.payment_intent_id || "—"}</span>
      </td>
      <td className="py-3 pr-4 text-sm">
        {row.booking_reference || (row.booking_id ? `#${row.booking_id.slice(0, 8).toUpperCase()}` : "—")}
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-sm font-medium tabular-nums">
        {formatRefundCents(row.amount_cents)}
        {row.currency.toLowerCase() !== "eur" && (
          <span className="ml-1 text-xs uppercase text-muted-foreground">({row.currency})</span>
        )}
      </td>
      <td className="py-3 pr-4 text-xs">{refundStatusLabel(row.status)}</td>
      <td className="py-3 pr-4">
        <Badge className="border-border bg-muted text-muted-foreground">{originLabel(row)}</Badge>
        {row.before_cutoff && (
          <Badge className="mt-1 block w-fit border-amber-500/30 bg-amber-500/10 text-amber-500">
            Avant mise en service
          </Badge>
        )}
      </td>
      <td className="min-w-64 py-3">
        {!row.can_issue ? (
          <p className="text-xs text-muted-foreground">{row.blocker || "Aucune action possible."}</p>
        ) : step === "idle" ? (
          <div className="space-y-1.5">
          {row.notice && <p className="text-xs text-amber-500">{row.notice}</p>}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2.5 text-xs"
            disabled={pending}
            onClick={() => setStep("check")}
          >
            <Receipt className="size-3" />
            Émettre l&apos;avoir
          </Button>
          </div>
        ) : step === "check" ? (
          <div className="space-y-2">
            <label htmlFor={checkboxId} className="flex cursor-pointer items-start gap-2 text-xs max-lg:min-h-11">
              <input
                id={checkboxId}
                type="checkbox"
                checked={checked}
                disabled={pending}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 shrink-0 accent-primary"
              />
              <span>
                J&apos;ai vérifié dans Stripe ce remboursement et qu&apos;aucun avoir n&apos;a déjà été émis pour lui
              </span>
            </label>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 px-2.5 text-xs" disabled={!checked || pending} onClick={() => setStep("confirm")}>
                Continuer
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" disabled={pending} onClick={reset}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium">{issueConfirmationQuestion(row)}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 gap-1.5 px-2.5 text-xs"
                disabled={pending}
                onClick={() => onIssue(row.stripe_refund_id)}
              >
                {pending && <Loader2 className="size-3 animate-spin" />}
                Confirmer l&apos;émission
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" disabled={pending} onClick={reset}>
                Retour
              </Button>
            </div>
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Activation des avoirs automatiques (deux étapes, une seule fois) ─────────

function ActivationPanel({
  active,
  pending,
  onActivate,
}: {
  active: boolean
  pending: boolean
  onActivate: () => void
}) {
  const [step, setStep] = useState<"idle" | "check" | "confirm">("idle")
  const [checked, setChecked] = useState(false)
  if (active) return null
  const reset = () => {
    setStep("idle")
    setChecked(false)
  }
  return (
    <div className="space-y-2 rounded-lg border border-border px-4 py-3">
      {step === "idle" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setStep("check")}>
          Activer les avoirs automatiques
        </Button>
      ) : step === "check" ? (
        <>
          <label htmlFor="activation-check" className="flex cursor-pointer items-start gap-2 text-sm max-lg:min-h-11">
            <input
              id="activation-check"
              type="checkbox"
              checked={checked}
              disabled={pending}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 shrink-0 accent-primary"
            />
            <span>
              Les nouvelles images (booking, payment) sont déployées et les événements de remboursement sont activés
              sur le webhook Stripe
            </span>
          </label>
          <div className="flex gap-2">
            <Button size="sm" disabled={!checked || pending} onClick={() => setStep("confirm")}>
              Continuer
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={reset}>
              Annuler
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">{ACTIVATION_QUESTION}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="gap-1.5" disabled={pending} onClick={onActivate}>
              {pending && <Loader2 className="size-3 animate-spin" />}
              Confirmer l&apos;activation
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={reset}>
              Retour
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const COLUMNS = ["Créé le", "Remboursement Stripe", "Course", "Montant", "Statut", "Origine", "Action"]

export default function StripeReconciliationPage() {
  const queryClient = useQueryClient()
  const [days, setDays] = useState<number>(DEFAULT_RECONCILIATION_DAYS)
  const [pendingId, setPendingId] = useState<string | null>(null)
  // Verrou synchrone : un double clic n'envoie qu'une requête (l'API est de toute façon idempotente).
  const sending = useRef(false)
  const { toasts, push: pushToast } = useToast()
  const queryKey = ["admin-stripe-reconciliation", days]

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => getStripeReconciliation(days),
    staleTime: 30_000,
  })
  const rows = data?.refunds ?? []

  const issueMutation = useMutation({
    mutationFn: (refundId: string) => issueStripeRefundCreditNote(refundId),
    onSuccess: (result) => pushToast("success", issueSuccessMessage(result)),
    onError: (err) => pushToast("error", issueErrorMessage(err)),
    onSettled: () => {
      sending.current = false
      setPendingId(null)
      queryClient.invalidateQueries({ queryKey: ["admin-stripe-reconciliation"] })
    },
  })

  const activationMutation = useMutation({
    mutationFn: activateStripeAutoCreditNotes,
    onSuccess: (result) => pushToast("success", activationSuccessMessage(result)),
    onError: (err) => pushToast("error", activationErrorMessage(err)),
    onSettled: () => {
      sending.current = false
      queryClient.invalidateQueries({ queryKey: ["admin-stripe-reconciliation"] })
    },
  })

  const handleActivate = () => {
    if (sending.current) return
    sending.current = true
    activationMutation.mutate()
  }

  const handleIssue = (refundId: string) => {
    if (sending.current) return
    sending.current = true
    setPendingId(refundId)
    issueMutation.mutate(refundId)
  }

  return (
    <div className="space-y-6">
      <BackButton href="/admin/dashboard" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Rapprochement Stripe</h1>
          <p className="mt-1 text-muted-foreground">
            {isLoading
              ? "Chargement…"
              : isError
                ? "Liste indisponible"
                : `${rows.length} remboursement${rows.length > 1 ? "s" : ""} Stripe sans avoir`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="reconciliation-days" className="text-sm text-muted-foreground">
            Période
          </label>
          <select
            id="reconciliation-days"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            {RECONCILIATION_PERIODS.map((d) => (
              <option key={d} value={d}>
                {d} derniers jours
              </option>
            ))}
          </select>
          <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Actualiser
          </Button>
        </div>
      </div>

      {data && (
        <div className="space-y-3">
          <p
            role="status"
            className={`rounded-lg border px-4 py-3 text-sm ${
              data.settings.cutoff_at
                ? "border-border bg-muted/40 text-muted-foreground"
                : "border-amber-500/30 bg-amber-500/10 text-amber-500"
            }`}
          >
            {autoCreditNotesStatus(data.settings)}
          </p>
          <ActivationPanel
            active={Boolean(data.settings.cutoff_at)}
            pending={activationMutation.isPending}
            onActivate={handleActivate}
          />
        </div>
      )}

      {data?.truncated && (
        <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
          Liste tronquée : plus de 300 remboursements sur la période. Réduisez la période.
        </div>
      )}

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
          {listErrorMessage(error)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <FileCheck2 className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">Chaque remboursement Stripe de la période a son avoir</p>
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
              {rows.map((r) => (
                <RefundRow key={r.stripe_refund_id} row={r} pending={pendingId === r.stripe_refund_id} onIssue={handleIssue} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Receipt className="size-3.5" />
        Lecture seule de Stripe. Un remboursement en attente dans Stripe ne reçoit son avoir qu&apos;une fois réussi ;
        un avoir en échec de l&apos;application se régularise dans « Avoirs à émettre ».
      </p>

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
