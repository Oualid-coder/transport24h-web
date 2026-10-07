"use client"

import { useMutation } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { completeBooking, ApiError } from "@/lib/api"

interface Props {
  open: boolean
  bookingId: string
  onClose: () => void
  onCompleted: () => void
}

export function CompleteBookingModal({ open, bookingId, onClose, onCompleted }: Props) {
  const mutation = useMutation<void, Error>({
    mutationFn: () => completeBooking(bookingId),
  })

  const is403 =
    mutation.isError &&
    mutation.error instanceof ApiError &&
    mutation.error.status === 403

  const is409 =
    mutation.isError &&
    mutation.error instanceof ApiError &&
    mutation.error.status === 409

  const is422 =
    mutation.isError &&
    mutation.error instanceof ApiError &&
    mutation.error.status === 422

  const handleDismiss = (isOpen: boolean) => {
    if (isOpen || mutation.isPending) return
    if (mutation.isSuccess) onCompleted()
    else onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-0 overflow-hidden p-0 bg-background"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="font-semibold">Terminer la course</DialogTitle>
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
          {mutation.isSuccess ? (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                Course marquée comme terminée.
              </div>
              <Button className="w-full" onClick={onCompleted}>
                Fermer
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Cette action est définitive. Confirmer que la course est terminée ?
              </p>

              {is403 && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  Cette course ne vous est plus assignée. Actualisez la page.
                </div>
              )}
              {is409 && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  Cette course ne peut pas être terminée dans son état actuel.
                </div>
              )}
              {is422 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  Cette course n&apos;a pas encore commencé.
                </div>
              )}
              {mutation.isError && !is403 && !is409 && !is422 && (
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
                  Annuler
                </Button>
                <Button
                  size="sm"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending && (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  )}
                  Confirmer
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
