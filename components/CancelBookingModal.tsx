"use client"

import { useMutation } from "@tanstack/react-query"
import { AlertCircle, Loader2, TriangleAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Booking, BookingStatus, CancellationResult } from "@/lib/types"
import { cancelBooking, ApiError } from "@/lib/api"

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PAID_STATUSES = new Set<BookingStatus>(["pending_review", "confirmed", "assigned"])

function refundTier(scheduledAt: string): 0 | 50 | 100 {
  const hoursUntil = (new Date(scheduledAt).getTime() - Date.now()) / 3_600_000
  if (hoursUntil > 24) return 100
  if (hoursUntil > 2) return 50
  return 0
}

// ── composant ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  booking: Booking
  onClose: () => void
  onCancelled: () => void
}

export function CancelBookingModal({ open, booking, onClose, onCancelled }: Props) {
  const isPaid = PAID_STATUSES.has(booking.status)
  const pct: 0 | 50 | 100 = isPaid ? refundTier(booking.scheduled_at) : 0
  const estimatedEuros = (booking.price_ttc * pct) / 100

  const mutation = useMutation<CancellationResult, Error>({
    mutationFn: () => cancelBooking(booking.id),
  })

  const is409 =
    mutation.isError &&
    mutation.error instanceof ApiError &&
    mutation.error.status === 409

  const handleDismiss = (isOpen: boolean) => {
    if (isOpen || mutation.isPending) return
    if (mutation.isSuccess) onCancelled()
    else onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-0 overflow-hidden p-0 bg-background"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="font-semibold">Annuler la réservation</DialogTitle>
          <DialogClose
            render={
              <button
                disabled={mutation.isPending}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                aria-label="Fermer"
              />
            }
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        <div className="space-y-4 p-5">
          {mutation.isSuccess && mutation.data != null ? (
            /* ── État succès ── */
            <>
              {mutation.data.refund_failed ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Annulation enregistrée. Le remboursement attendu ({mutation.data.refund_percent}&nbsp;%)
                    n&apos;a pas pu être déclenché automatiquement. Notre équipe prendra en charge votre dossier.
                  </span>
                </div>
              ) : mutation.data.refund_amount_cents > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Annulation confirmée. Un remboursement de{" "}
                  <span className="font-medium text-foreground">
                    {fmt(mutation.data.refund_amount_cents)} €
                  </span>{" "}
                  TTC a été déclenché sur votre carte.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Annulation confirmée. Aucun remboursement applicable.
                </p>
              )}
              <Button className="w-full" onClick={onCancelled}>
                Fermer
              </Button>
            </>
          ) : (
            /* ── Confirmation ── */
            <>
              <div className="space-y-2 text-sm text-muted-foreground">
                {isPaid ? (
                  <>
                    {pct === 100 && (
                      <p>
                        Vous annulez{" "}
                        <span className="font-medium text-foreground">plus de 24 h</span>{" "}
                        avant la course — remboursement intégral (100 %), soit environ{" "}
                        <span className="font-medium text-foreground">
                          {estimatedEuros.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          €
                        </span>{" "}
                        TTC.
                      </p>
                    )}
                    {pct === 50 && (
                      <p>
                        Vous annulez{" "}
                        <span className="font-medium text-foreground">entre 2 et 24 h</span>{" "}
                        avant la course — remboursement à 50 %, soit environ{" "}
                        <span className="font-medium text-foreground">
                          {estimatedEuros.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          €
                        </span>{" "}
                        TTC.
                      </p>
                    )}
                    {pct === 0 && (
                      <p>
                        La course est dans{" "}
                        <span className="font-medium text-foreground">moins de 2 h</span> —
                        conformément aux CGV,{" "}
                        <span className="font-medium text-foreground">aucun remboursement</span>{" "}
                        ne sera effectué.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/70">
                      Le montant exact est calculé au moment de l&apos;annulation.
                    </p>
                  </>
                ) : (
                  <p>
                    Cette réservation n&apos;a pas encore été payée. L&apos;annulation sera
                    immédiate, sans remboursement.
                  </p>
                )}
              </div>

              {is409 && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  Cette réservation ne peut pas être annulée dans son état actuel.
                </div>
              )}
              {mutation.isError && !is409 && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  Une erreur est survenue. Veuillez réessayer.
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={mutation.isPending}
                >
                  Conserver
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending && (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  )}
                  Confirmer l&apos;annulation
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
