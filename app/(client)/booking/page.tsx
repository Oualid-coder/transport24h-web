"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useState } from "react"
import { Loader2, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createSavedQuote, createBooking, ApiError } from "@/lib/api"
import { TRUCK_VOLUME } from "@/lib/types"
import type { TruckType } from "@/lib/types"

function BookingContent() {
  const sp = useSearchParams()
  const router = useRouter()

  // Paramètres transmis depuis le formulaire devis
  const truck = (sp.get("truck") ?? "16m3") as TruckType
  const handlers = Number(sp.get("handlers") ?? 1)
  const pickupLat = Number(sp.get("pickupLat"))
  const pickupLng = Number(sp.get("pickupLng"))
  const pickupAddress = sp.get("pickup") ?? ""
  const deliveryLat = Number(sp.get("deliveryLat"))
  const deliveryLng = Number(sp.get("deliveryLng"))
  const deliveryAddress = sp.get("delivery") ?? ""
  const phone = sp.get("phone") ?? ""
  const comment = sp.get("comment") ?? ""

  const [scheduledAt, setScheduledAt] = useState("")
  const [scheduledTime, setScheduledTime] = useState("09:00")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduledAt || !scheduledTime) return
    setLoading(true)
    setError(null)

    // RFC3339 : "2026-04-20T09:00:00+02:00"
    // On utilise l'offset local pour être correct côté backend
    const localOffset = -new Date().getTimezoneOffset()
    const sign = localOffset >= 0 ? "+" : "-"
    const hh = String(Math.floor(Math.abs(localOffset) / 60)).padStart(2, "0")
    const mm = String(Math.abs(localOffset) % 60).padStart(2, "0")
    const scheduledAtRFC3339 = `${scheduledAt}T${scheduledTime}:00${sign}${hh}:${mm}`

    try {
      // Étape 1 — Créer le devis sauvegardé (authentifié)
      const savedQuote = await createSavedQuote({
        pickup_address: pickupAddress,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        delivery_address: deliveryAddress,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        volume_m3: TRUCK_VOLUME[truck],
        helpers_count: handlers,
        truck_type: truck,
      })

      // Étape 2 — Créer la réservation avec le quote_id
      const booking = await createBooking({
        quote_id: savedQuote.id,
        scheduled_at: scheduledAtRFC3339,
        client_comment: comment || undefined,
      })

      // Redirection vers la confirmation / paiement
      window.location.href = `/booking/confirmation?id=${booking.id}`
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          // Session expirée — retour au login
          router.push(
            `/login?redirect=${encodeURIComponent(
              window.location.pathname + window.location.search,
            )}`,
          )
          return
        }
        setError(err.message)
      } else {
        setError("Une erreur est survenue. Veuillez réessayer.")
      }
    } finally {
      setLoading(false)
    }
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split("T")[0]!

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">Confirmer la réservation</h1>
      <p className="mb-8 text-muted-foreground">
        Vérifiez les détails et choisissez la date de votre transport.
      </p>

      <div className="space-y-6">
        {/* Résumé du devis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Truck className="size-4 text-primary" />
              Résumé de votre demande
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Départ</p>
                <p className="font-medium line-clamp-2">
                  {pickupAddress || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Arrivée</p>
                <p className="font-medium line-clamp-2">
                  {deliveryAddress || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Camion</p>
                <p className="font-medium">{truck}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Manutentionnaires
                </p>
                <p className="font-medium">
                  {handlers === 0 ? "Aucun" : handlers}
                </p>
              </div>
              {phone && (
                <div>
                  <p className="text-xs text-muted-foreground">Téléphone</p>
                  <p className="font-medium">{phone}</p>
                </div>
              )}
              {comment && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Commentaire</p>
                  <p className="font-medium">{comment}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Date et heure */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Date et heure souhaitées</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  min={minDate}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time">Heure</Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Confirmer la réservation
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Votre réservation sera confirmée par notre équipe sous 2h.
          </p>
        </form>
      </div>
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  )
}
