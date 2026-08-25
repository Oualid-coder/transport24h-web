"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { adminRefund, ApiError } from "@/lib/api"

interface RefundModalProps {
  open: boolean
  bookingId: string
  amountTTC: number
  queryKey: unknown[]
  onClose: () => void
}

export function RefundModal({
  open,
  bookingId,
  amountTTC,
  queryKey,
  onClose,
}: RefundModalProps) {
  const queryClient = useQueryClient()
  const [amountInput, setAmountInput] = useState(amountTTC.toFixed(2))
  const [reason, setReason] = useState("")
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const cents = Math.round(parseFloat(amountInput) * 100)
      return adminRefund(bookingId, cents, reason.trim())
    },
    onSuccess: () => {
      setSuccess(true)
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors du remboursement.",
      )
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(amountInput)
    if (isNaN(amount) || amount <= 0) {
      setError("Montant invalide.")
      return
    }
    if (amount > amountTTC) {
      setError(`Le montant ne peut pas dépasser ${amountTTC.toFixed(2)} €.`)
      return
    }
    if (!reason.trim()) {
      setError("Le motif est requis.")
      return
    }
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !mutation.isPending) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-0 overflow-hidden p-0 bg-background"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="font-semibold">
            {success ? "Remboursement initié" : "Rembourser ce paiement"}
          </DialogTitle>
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

        {success ? (
          /* ── État succès ── */
          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
              <p>
                Remboursement de{" "}
                <strong>{parseFloat(amountInput).toFixed(2)} €</strong> initié
                avec succès. Le client recevra un email de confirmation Stripe
                sous 5 à 10 jours ouvrés.
              </p>
            </div>
            <Button className="w-full" onClick={onClose}>
              Fermer
            </Button>
          </div>
        ) : (
          /* ── Formulaire ── */
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Cette action est <strong>irréversible</strong>. Le
                remboursement sera traité par Stripe.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="refund-amount" className="text-sm font-medium">
                Montant à rembourser (€ TTC)
              </label>
              <Input
                id="refund-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={amountTTC}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="font-mono"
                aria-describedby={error ? "refund-error" : undefined}
                aria-invalid={!!error}
              />
              <p className="text-xs text-muted-foreground">
                Maximum : {amountTTC.toFixed(2)} €
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="refund-reason" className="text-sm font-medium">
                Motif
              </label>
              <Textarea
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Ex : Annulation client, prestation non réalisée…"
                aria-describedby={error ? "refund-error" : undefined}
                aria-invalid={!!error}
              />
            </div>

            {error && (
              <p id="refund-error" role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={mutation.isPending}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="flex-1"
                disabled={mutation.isPending}
              >
                {mutation.isPending && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                Confirmer le remboursement
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
