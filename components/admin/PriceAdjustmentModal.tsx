"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { closePriceAdjustment, createPriceAdjustment, getPriceAdjustments, previewPriceAdjustment } from "@/lib/api"
import { priceChanged } from "@/lib/price"
import {
  CLOSE_OUTCOME_LABEL,
  REASON_MAX_LENGTH,
  STATUS_LABEL,
  adjustmentFailure,
  adjustmentFormError,
  adjustmentOutcome,
  attemptAfterFailure,
  attemptOnOpen,
  buildAdjustmentBody,
  buildCloseBody,
  canClose,
  canResume,
  closeConfirmationQuestion,
  closeErrorMessage,
  closeFormError,
  closureSummary,
  isCloseFinish,
  confirmationQuestion,
  formatCents,
  parseFrenchPrice,
  previewBlocker,
  previewErrorMessage,
  resumeBody,
  type AttemptState,
} from "@/lib/price-adjustment"
import type {
  PriceAdjustment,
  PriceAdjustmentBody,
  PriceAdjustmentCloseBody,
  PriceAdjustmentCloseOutcome,
  PriceAdjustmentPreview,
} from "@/lib/types"

const PREVIEW_DEBOUNCE_MS = 400

const fmtHT = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT`

const newRequestId = () => crypto.randomUUID()

interface Confirmed {
  body: PriceAdjustmentBody
  question: string
  deltaCents: number
  oldPriceHT: number
  ttc: { old: number; new: number } | null // absent pour la reprise d'une ligne de l'historique
  resume: boolean
}

interface PriceAdjustmentModalProps {
  open: boolean
  bookingId: string
  currentPriceHT: number
  queryKey: unknown[]
  onClose: () => void
}

export function PriceAdjustmentModal({
  open,
  bookingId,
  currentPriceHT,
  queryKey,
  onClose,
}: PriceAdjustmentModalProps) {
  const queryClient = useQueryClient()
  // Conservé entre deux ouvertures : une opération au résultat incertain se reprend avec le même request_id.
  const [attempt, setAttempt] = useState<AttemptState | null>(null)
  const [prevOpen, setPrevOpen] = useState(false)
  const [priceInput, setPriceInput] = useState("")
  const [reason, setReason] = useState("")
  const [clientAgreed, setClientAgreed] = useState(false)
  const [step, setStep] = useState<"form" | "confirm" | "done" | "stopped" | "close" | "closeConfirm">("form")
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null)
  const [result, setResult] = useState<PriceAdjustment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sending = useRef(false)
  // Clôture d'une ligne bloquée : deux étapes (saisie de l'issue constatée, puis confirmation).
  const [closing, setClosing] = useState<PriceAdjustment | null>(null)
  const [closeOutcome, setCloseOutcome] = useState<PriceAdjustmentCloseOutcome | null>(null)
  const [closeReason, setCloseReason] = useState("")
  const [closeIds, setCloseIds] = useState("")
  const [closeParts, setCloseParts] = useState<string[]>([])

  // Ouverture : nouvelle opération (champs vides, nouvel request_id) sauf reprise d'un résultat incertain.
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      const next = attemptOnOpen(attempt, newRequestId)
      setAttempt(next)
      if (!next.locked) {
        setPriceInput("")
        setReason("")
        setClientAgreed(false)
        setStep("form")
        setConfirmed(null)
        setResult(null)
        setError(null)
        setClosing(null)
      }
    }
  }

  const locked = attempt?.locked ?? false
  const parsedPrice = parseFrenchPrice(priceInput)

  // Anti-rebond : l'aperçu n'est demandé qu'une fois la saisie stable.
  const [debouncedPrice, setDebouncedPrice] = useState<number | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPrice(parsedPrice), PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [parsedPrice])

  const previewPrice =
    debouncedPrice !== null && priceChanged(currentPriceHT, debouncedPrice) ? debouncedPrice : null
  const preview = useQuery({
    queryKey: ["admin-price-adjustment-preview", bookingId, previewPrice],
    queryFn: ({ signal }) => previewPriceAdjustment(bookingId, previewPrice ?? 0, signal),
    enabled: open && step === "form" && previewPrice !== null,
    retry: false,
    staleTime: 0,
  })
  // Aperçu utilisable seulement s'il correspond exactement au prix saisi.
  const previewReady =
    preview.data !== undefined &&
    !preview.isFetching &&
    previewPrice !== null &&
    previewPrice === parsedPrice

  const history = useQuery({
    queryKey: ["admin-price-adjustments", bookingId],
    queryFn: () => getPriceAdjustments(bookingId),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: ({ body }: { body: PriceAdjustmentBody; retrying: boolean }) =>
      createPriceAdjustment(bookingId, body),
    onSuccess: ({ adjustment }) => {
      setResult(adjustment)
      setStep("done")
      setError(null)
      // Opération terminée : la prochaine ouverture repart avec un nouvel request_id.
      setAttempt((a) => (a ? { ...a, locked: false } : a))
    },
    onError: (err, { retrying }) => {
      const failure = adjustmentFailure(err, retrying)
      setError(failure.message)
      setAttempt((a) => (a ? attemptAfterFailure(a, failure.kind, newRequestId) : a))
      if (failure.kind === "definitive") setStep("form")
      if (failure.kind === "stopped") setStep("stopped")
    },
    onSettled: () => {
      sending.current = false
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ["admin-price-adjustments", bookingId] })
    },
  })

  const closeMutation = useMutation({
    mutationFn: ({ adjustmentId, body }: { adjustmentId: string; body: PriceAdjustmentCloseBody }) =>
      closePriceAdjustment(bookingId, adjustmentId, body),
    onSuccess: ({ adjustment }) => {
      setResult(adjustment)
      setClosing(null)
      setError(null)
      setStep("done")
    },
    onError: (err) => {
      // Jamais de nouvel essai automatique : retour à la saisie avec le message de l'API.
      setError(closeErrorMessage(err))
      setStep("close")
    },
    onSettled: () => {
      sending.current = false
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ["admin-price-adjustments", bookingId] })
    },
  })
  const busy = mutation.isPending || closeMutation.isPending

  // Étape 1 de la clôture : saisie de l'issue constatée dans Stripe.
  const startClose = (a: PriceAdjustment) => {
    if (busy) return
    setClosing(a)
    setCloseOutcome(null)
    setCloseReason("")
    setCloseIds("")
    setCloseParts((a.refund_parts ?? []).map(() => ""))
    // Clôture « opération effectuée » déjà enregistrée : seule issue possible, la terminer.
    setCloseOutcome(isCloseFinish(a) ? "executed" : null)
    setError(null)
    setStep("close")
  }

  // Étape 2 : confirmation explicite, après contrôle de la saisie.
  const goToCloseConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!closing) return
    const formError = closeFormError(closing, {
      outcome: closeOutcome,
      reason: closeReason,
      stripeIds: closeIds,
      partIds: closeParts,
    })
    if (formError) {
      setError(formError)
      return
    }
    setError(null)
    setStep("closeConfirm")
  }

  const sendClose = () => {
    if (!closing || !closeOutcome || sending.current || busy) return
    sending.current = true
    setError(null)
    closeMutation.mutate({
      adjustmentId: closing.id,
      body: buildCloseBody({ outcome: closeOutcome, reason: closeReason, stripeIds: closeIds, partIds: closeParts }),
    })
  }

  const goToConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!attempt || locked) return
    const formError = adjustmentFormError({ priceInput, reason, clientAgreed, currentPriceHT })
    if (formError) {
      setError(formError)
      return
    }
    if (preview.error) {
      setError(previewErrorMessage(preview.error))
      return
    }
    const question = previewReady && preview.data ? confirmationQuestion(preview.data) : null
    if (!preview.data || !previewReady || parsedPrice === null || !question) {
      setError("Attendez la fin du calcul du montant avant de continuer.")
      return
    }
    const blocker = previewBlocker(preview.data)
    if (blocker) {
      setError(blocker)
      return
    }
    setError(null)
    setConfirmed({
      body: buildAdjustmentBody(parsedPrice, reason, attempt.requestId),
      question,
      deltaCents: preview.data.delta_cents,
      oldPriceHT: preview.data.old_price_ht,
      ttc: { old: preview.data.old_price_ttc_cents, new: preview.data.new_price_ttc_cents },
      resume: false,
    })
    setStep("confirm")
  }

  // Reprise d'une opération interrompue (ligne « pending ») : même request_id et mêmes paramètres,
  // après la même confirmation explicite. Verrouillée comme un nouvel essai.
  const resume = (a: PriceAdjustment) => {
    const question = confirmationQuestion(a)
    if (!question || mutation.isPending) return
    setAttempt({ requestId: a.request_id, locked: true })
    setConfirmed({
      body: resumeBody(a),
      question,
      deltaCents: a.delta_cents,
      oldPriceHT: a.old_price_ht,
      ttc: null,
      resume: true,
    })
    setError(null)
    setStep("confirm")
  }

  // Envoi unique : bouton désactivé et garde synchrone contre le double clic.
  const send = () => {
    if (!confirmed || sending.current || mutation.isPending) return
    sending.current = true
    setError(null)
    mutation.mutate({ body: confirmed.body, retrying: locked })
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) close()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] max-w-md gap-0 overflow-y-auto p-0 bg-background"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="font-semibold">
            {step === "done" && result
              ? { succeeded: "Prix ajusté", pending: "Ajustement en cours", failed: "Ajustement échoué" }[
                  adjustmentOutcome(result.status)
                ]
              : step === "stopped"
                ? "Ajustement interrompu"
                : step === "close" || step === "closeConfirm"
                  ? "Clore l'ajustement bloqué"
                  : "Ajuster le prix"}
          </DialogTitle>
          <DialogClose
            render={
              <button
                disabled={busy}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 max-lg:-m-2.5 max-lg:p-3.5"
                aria-label="Fermer"
              />
            }
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        {step === "form" && (
          <form onSubmit={goToConfirm} className="space-y-4 p-5">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Course payée : une hausse est <strong>débitée sur la carte du client</strong>, une
                baisse lui est <strong>remboursée</strong> (avec un avoir). Uniquement à la demande
                du client et avec son accord.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adjust-price" className="text-sm font-medium">
                Nouveau prix (€ HT)
              </label>
              <Input
                id="adjust-price"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="Ex : 120,50"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Prix actuel : {fmtHT(currentPriceHT)}</p>
            </div>

            <div aria-live="polite" className="min-h-5 text-sm">
              {previewPrice !== null && previewPrice === parsedPrice ? (
                preview.isFetching ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Calcul du montant…
                  </span>
                ) : preview.error ? (
                  <span className="text-destructive">{previewErrorMessage(preview.error)}</span>
                ) : preview.data ? (
                  <PreviewSummary preview={preview.data} />
                ) : null
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="adjust-reason" className="text-sm font-medium">
                Motif
              </label>
              <Textarea
                id="adjust-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={REASON_MAX_LENGTH}
                placeholder="Ex : étage supplémentaire demandé par le client…"
              />
              <p className="text-right text-xs text-muted-foreground">
                {[...reason].length} / {REASON_MAX_LENGTH}
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <input
                id="adjust-agreed"
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={clientAgreed}
                onChange={(e) => setClientAgreed(e.target.checked)}
                aria-required="true"
              />
              <label htmlFor="adjust-agreed" className="text-sm leading-relaxed max-lg:min-h-11">
                Le client a donné son accord
              </label>
            </div>

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={close}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                Continuer
              </Button>
            </div>
          </form>
        )}

        {step === "confirm" && confirmed && (
          <div className="space-y-4 p-5">
            <p className="text-base font-semibold">{confirmed.question}</p>
            <div className="space-y-1 rounded-lg bg-accent/40 px-3 py-2.5 text-sm text-muted-foreground">
              <p>
                Prix : {fmtHT(confirmed.oldPriceHT)} → {fmtHT(confirmed.body.new_price_ht)}
              </p>
              {confirmed.ttc && (
                <p>
                  TTC : {formatCents(confirmed.ttc.old)} → {formatCents(confirmed.ttc.new)}
                </p>
              )}
              {confirmed.resume && <p>Reprise d&apos;une opération interrompue (même demande).</p>}
              <p className="break-words">Motif : {confirmed.body.reason}</p>
            </div>

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              {locked ? (
                <Button type="button" variant="outline" className="flex-1" disabled={mutation.isPending} onClick={close}>
                  Fermer
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setError(null)
                    setStep("form")
                  }}
                >
                  Modifier
                </Button>
              )}
              <Button
                type="button"
                variant={confirmed.deltaCents < 0 ? "destructive" : "default"}
                className="flex-1"
                disabled={mutation.isPending}
                onClick={send}
              >
                {mutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                {confirmed.resume && !error
                  ? "Reprendre"
                  : locked
                    ? "Réessayer"
                    : confirmed.deltaCents < 0
                      ? "Rembourser"
                      : "Débiter"}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4 p-5">
            {adjustmentOutcome(result.status) === "succeeded" ? (
              <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p>
                    {result.delta_cents < 0 ? "Remboursé" : "Débité"} :{" "}
                    <strong>{formatCents(Math.abs(result.delta_cents))}</strong> (
                    {fmtHT(result.old_price_ht)} → {fmtHT(result.new_price_ht)})
                  </p>
                  {result.invoice_number && <p>Facture n° {result.invoice_number}</p>}
                  {result.credit_note_number && <p>Avoir n° {result.credit_note_number}</p>}
                </div>
              </div>
            ) : adjustmentOutcome(result.status) === "failed" ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p>
                    Cette demande d&apos;ajustement a échoué ({fmtHT(result.old_price_ht)} →{" "}
                    {fmtHT(result.new_price_ht)}). Vérifiez la course et l&apos;historique avant toute
                    nouvelle demande.
                  </p>
                  {result.failure_reason && <p>Cause : {result.failure_reason}</p>}
                  {closureSummary(result) && <p>{closureSummary(result)}</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
                <Clock className="mt-0.5 size-4 shrink-0" />
                <p>
                  Ajustement en cours de traitement ({fmtHT(result.old_price_ht)} →{" "}
                  {fmtHT(result.new_price_ht)}). Consultez l&apos;historique dans quelques instants.
                </p>
              </div>
            )}
            <Button className="w-full" onClick={close}>
              Fermer
            </Button>
          </div>
        )}

        {step === "stopped" && (
          <div className="space-y-4 p-5">
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
            <Button className="w-full" onClick={close}>
              Fermer
            </Button>
          </div>
        )}

        {step === "close" && closing && (
          <form onSubmit={goToCloseConfirm} className="space-y-4 p-5">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                {closing.delta_cents < 0 ? "Baisse" : "Hausse"} de{" "}
                <strong>{formatCents(Math.abs(closing.delta_cents))}</strong> interrompue : la reprise
                automatique n&apos;est plus possible. Vérifiez dans Stripe (métadonnée{" "}
                <code>price_adjustment_id</code> = {closing.id}) puis indiquez ce que vous avez constaté.
                Aucun débit ni remboursement ne sera fait.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Constaté dans Stripe</legend>
              {(closing.closable_outcomes ?? []).map((o) => (
                <label key={o} className="flex items-start gap-2.5 text-sm max-lg:min-h-11">
                  <input
                    type="radio"
                    name="close-outcome"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    checked={closeOutcome === o}
                    onChange={() => setCloseOutcome(o)}
                  />
                  {CLOSE_OUTCOME_LABEL[o]}
                </label>
              ))}
              {isCloseFinish(closing) && (
                <p className="text-xs text-muted-foreground">
                  Clôture déjà enregistrée, mise à jour du prix ou des documents restée en échec : terminez-la.
                </p>
              )}
            </fieldset>

            {closeOutcome === "partial" && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Parts du remboursement</legend>
                <p className="text-xs text-muted-foreground">
                  Pour chaque part, indiquez le remboursement constaté (re_…) ou laissez vide si elle n&apos;a pas eu lieu.
                </p>
                {(closing.refund_parts ?? []).map((p, i) => (
                  <div key={i} className="space-y-1">
                    <label htmlFor={`close-part-${i}`} className="text-xs">
                      Part {i + 1} : <strong>{formatCents(p.amount_cents)}</strong> sur{" "}
                      <span className="font-mono">{p.payment_intent}</span>
                    </label>
                    <Input
                      id={`close-part-${i}`}
                      type="text"
                      autoComplete="off"
                      value={closeParts[i] ?? ""}
                      onChange={(e) => setCloseParts((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                      placeholder="re_… ou vide : non exécutée"
                      className="font-mono"
                    />
                  </div>
                ))}
              </fieldset>
            )}

            {closeOutcome === "executed" && !isCloseFinish(closing) && (
              <div className="space-y-1.5">
                <label htmlFor="close-ids" className="text-sm font-medium">
                  {closing.delta_cents < 0 ? "Identifiant(s) du remboursement (re_…)" : "Identifiant du paiement (pi_…)"}
                </label>
                <Input
                  id="close-ids"
                  type="text"
                  autoComplete="off"
                  value={closeIds}
                  onChange={(e) => setCloseIds(e.target.value)}
                  className="font-mono"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="close-reason" className="text-sm font-medium">
                Motif
              </label>
              <Textarea
                id="close-reason"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                rows={2}
                maxLength={REASON_MAX_LENGTH}
                placeholder="Ex : vérifié dans le tableau de bord Stripe le …"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setClosing(null)
                  setError(null)
                  setStep("form")
                }}
              >
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                Continuer
              </Button>
            </div>
          </form>
        )}

        {step === "closeConfirm" && closing && closeOutcome && (
          <div className="space-y-4 p-5">
            <p className="text-base font-semibold">{closeConfirmationQuestion(closing, closeOutcome, closeParts)}</p>
            <div className="space-y-1 rounded-lg bg-accent/40 px-3 py-2.5 text-sm text-muted-foreground">
              <p>{CLOSE_OUTCOME_LABEL[closeOutcome]}</p>
              {closeOutcome === "executed" && !isCloseFinish(closing) && (
                <p className="break-all font-mono">{closeIds.replace(/\s+/g, "")}</p>
              )}
              {closeOutcome === "partial" &&
                (closing.refund_parts ?? []).map((p, i) => (
                  <p key={i} className="break-all">
                    Part {i + 1} ({formatCents(p.amount_cents)}) :{" "}
                    {closeParts[i]?.trim() ? <span className="font-mono">{closeParts[i].trim()}</span> : "non exécutée"}
                  </p>
                ))}
              <p className="break-words">Motif : {closeReason.trim()}</p>
              <p>Action définitive, enregistrée à votre nom.</p>
            </div>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  setStep("close")
                }}
              >
                Modifier
              </Button>
              <Button type="button" variant="destructive" className="flex-1" disabled={busy} onClick={sendClose}>
                {closeMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                {isCloseFinish(closing) ? "Terminer la clôture" : "Clore définitivement"}
              </Button>
            </div>
          </div>
        )}

        {step !== "confirm" && step !== "close" && step !== "closeConfirm" && (history.data?.adjustments.length ?? 0) > 0 && (
          <div className="space-y-2 border-t border-border px-5 py-4">
            <p className="text-sm font-medium">Ajustements précédents</p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {history.data?.adjustments.map((a) => (
                <li key={a.id} className="rounded-md bg-accent/40 px-3 py-2">
                  <p className="text-foreground">
                    {new Date(a.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    {" · "}
                    {a.delta_cents < 0 ? "Baisse" : "Hausse"} {formatCents(Math.abs(a.delta_cents))}
                    {" · "}
                    {STATUS_LABEL[a.status] ?? a.status}
                  </p>
                  <p>
                    {fmtHT(a.old_price_ht)} → {fmtHT(a.new_price_ht)}
                    {a.invoice_number && ` · Facture ${a.invoice_number}`}
                    {a.credit_note_number && ` · Avoir ${a.credit_note_number}`}
                  </p>
                  <p className="break-words italic">{a.reason}</p>
                  {a.status === "failed" && a.failure_reason && (
                    <p className="break-words text-destructive">Cause : {a.failure_reason}</p>
                  )}
                  {closureSummary(a) && <p className="break-words">{closureSummary(a)}</p>}
                  {a.status === "pending" && (
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="font-medium text-amber-500">Opération interrompue</span>
                      {step === "form" && (
                        <div className="flex gap-1.5">
                          {canResume(a) && (
                            <Button size="sm" variant="outline" className="h-7" onClick={() => resume(a)}>
                              Reprendre
                            </Button>
                          )}
                          {canClose(a) && (
                            <Button size="sm" variant="outline" className="h-7" onClick={() => startClose(a)}>
                              {isCloseFinish(a) ? "Terminer la clôture" : "Clore"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {a.status === "pending" && step === "form" && canResume(a) && (
                    <p className="mt-1">Seul l&apos;admin qui a lancé l&apos;opération peut la reprendre.</p>
                  )}
                  {a.status === "pending" && step === "form" && canClose(a) && (
                    <p className="mt-1">
                      {isCloseFinish(a)
                        ? "Clôture enregistrée, suite en échec : « Terminer la clôture » (tout admin)."
                        : "Reprise automatique expirée : vérifiez dans Stripe, puis « Clore »."}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PreviewSummary({ preview }: { preview: PriceAdjustmentPreview }) {
  const amount = formatCents(Math.abs(preview.delta_cents))
  return (
    <p className="text-foreground">
      {preview.delta_cents < 0 ? (
        <>
          <strong>{amount}</strong> seront remboursés au client (remboursable au plus :{" "}
          {formatCents(preview.refundable_cents)}).
        </>
      ) : (
        <>
          <strong>{amount}</strong> seront débités sur la carte du client.
        </>
      )}{" "}
      <span className="text-muted-foreground">
        (TTC : {formatCents(preview.old_price_ttc_cents)} → {formatCents(preview.new_price_ttc_cents)})
      </span>
    </p>
  )
}
