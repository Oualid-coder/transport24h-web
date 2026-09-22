"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Info, Loader2, MapPin, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { AddressInput } from "@/components/AddressInput"
import { updateBookingAddress, ApiError } from "@/lib/api"
import type { Booking, GeoPoint } from "@/lib/types"

export function EditAddressModal({
  open,
  booking,
  onClose,
  onUpdated,
}: {
  open: boolean
  booking: Booking
  onClose: () => void
  onUpdated: () => void
}) {
  const [newPickup, setNewPickup] = useState<GeoPoint | null>(null)
  const [newDelivery, setNewDelivery] = useState<GeoPoint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatedBooking, setUpdatedBooking] = useState<Booking | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof updateBookingAddress>[1] = {}
      if (newPickup) {
        body.pickup_address = newPickup.address
        body.pickup_lat = newPickup.lat
        body.pickup_lng = newPickup.lng
      }
      if (newDelivery) {
        body.delivery_address = newDelivery.address
        body.delivery_lat = newDelivery.lat
        body.delivery_lng = newDelivery.lng
      }
      return updateBookingAddress(booking.id, body)
    },
    onSuccess: (updated) => setUpdatedBooking(updated),
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue. Veuillez réessayer.",
      )
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPickup && !newDelivery) {
      setError("Veuillez sélectionner au moins une nouvelle adresse.")
      return
    }
    setError(null)
    mutation.mutate()
  }

  const handleDismiss = (isOpen: boolean) => {
    if (isOpen || mutation.isPending) return
    if (updatedBooking) onUpdated()
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
          <DialogTitle className="font-semibold">
            {updatedBooking ? "Adresse mise à jour" : "Modifier l'adresse"}
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

        {updatedBooking ? (
          /* ── État succès ── */
          <div className="space-y-4 p-5">
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
              <p className="font-medium">Adresse modifiée avec succès.</p>
              <p className="mt-1 text-primary/80">
                Nouveau prix :{" "}
                <span className="font-semibold">
                  {updatedBooking.price_ttc.toFixed(2)} € TTC
                </span>{" "}
                <span className="text-xs">
                  (était {booking.price_ttc.toFixed(2)} € TTC)
                </span>
              </p>
            </div>
            <Button className="w-full" onClick={onUpdated}>
              Fermer
            </Button>
          </div>
        ) : (
          /* ── Formulaire ── */
          <form onSubmit={handleSubmit} className="space-y-5 p-5">
            {/* Avertissement recalcul prix */}
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-500">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <p>
                Le prix sera <strong>recalculé automatiquement</strong> selon la
                nouvelle distance. Vous pouvez modifier l&apos;une ou les deux
                adresses.
              </p>
            </div>

            {/* Adresse de départ */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Adresse de départ</label>
              <AddressInput
                placeholder="Nouvelle adresse de départ…"
                onSelect={setNewPickup}
              />
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                <span className="line-clamp-1">
                  Actuelle : {booking.pickup_address}
                </span>
              </p>
            </div>

            {/* Adresse de destination */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Adresse de destination
              </label>
              <AddressInput
                placeholder="Nouvelle adresse de destination…"
                onSelect={setNewDelivery}
              />
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                <span className="line-clamp-1">
                  Actuelle : {booking.delivery_address}
                </span>
              </p>
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
                disabled={mutation.isPending}
                onClick={onClose}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={mutation.isPending}
              >
                {mutation.isPending && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                Confirmer
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
