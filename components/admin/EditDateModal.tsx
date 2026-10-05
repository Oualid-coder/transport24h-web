"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Calendar, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { updateBookingSchedule, ApiError } from "@/lib/api"
import type { PaginatedBookings } from "@/lib/types"

interface EditDateModalProps {
  open: boolean
  bookingId: string
  currentScheduledAt: string
  queryKey: unknown[]
  onClose: () => void
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Rendu uniquement quand open=true — se monte à chaque ouverture avec un état
// initialisé depuis la date courante, sans useEffect de synchronisation.
function EditDateForm({
  bookingId,
  currentScheduledAt,
  queryKey,
  onClose,
}: Omit<EditDateModalProps, "open">) {
  const queryClient = useQueryClient()
  const [dateInput, setDateInput] = useState(() =>
    toDatetimeLocal(currentScheduledAt),
  )
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      updateBookingSchedule(bookingId, new Date(dateInput).toISOString()),
    onSuccess: (updated) => {
      queryClient.setQueryData<PaginatedBookings>(queryKey, (old) =>
        old
          ? { ...old, bookings: old.bookings.map((b) => (b.id === updated.id ? updated : b)) }
          : old,
      )
      onClose()
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setError("La date choisie est déjà passée.")
        } else if (err.status === 409) {
          setError("Impossible de modifier : la course est terminée ou annulée.")
        } else {
          setError(err.message)
        }
      } else {
        setError("Une erreur est survenue. Veuillez réessayer.")
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!dateInput) {
      setError("Veuillez choisir une date et une heure.")
      return
    }
    setError(null)
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-5">
      <div className="space-y-1.5">
        <label htmlFor="scheduled-at" className="text-sm font-medium">
          Date et heure de la course
        </label>
        <Input
          id="scheduled-at"
          type="datetime-local"
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "date-error" : undefined}
        />
      </div>

      {error && (
        <p id="date-error" role="alert" className="text-xs text-destructive">
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
        <Button type="submit" className="flex-1" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Calendar className="mr-1.5 size-3.5" />
          )}
          Enregistrer
        </Button>
      </div>
    </form>
  )
}

export function EditDateModal({
  open,
  bookingId,
  currentScheduledAt,
  queryKey,
  onClose,
}: EditDateModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-0 overflow-hidden p-0 bg-background"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="font-semibold">Modifier la date</DialogTitle>
          <DialogClose
            render={
              <button
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                aria-label="Fermer"
              />
            }
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        {open && (
          <EditDateForm
            bookingId={bookingId}
            currentScheduledAt={currentScheduledAt}
            queryKey={queryKey}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
