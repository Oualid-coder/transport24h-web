"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useState, useEffect } from "react"
import { Loader2, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createSavedQuote, createBooking, ApiError } from "@/lib/api"
import { TRUCK_VOLUME } from "@/lib/types"
import type { TruckType } from "@/lib/types"

const DRAFT_KEY = "booking_draft"

interface BookingDraft {
  truck: TruckType
  handlers: number
  pickupLat: number
  pickupLng: number
  pickup: string
  deliveryLat: number
  deliveryLng: number
  delivery: string
  phone: string
  comment: string
}

function draftFromSearchParams(
  sp: Omit<URLSearchParams, "append" | "delete" | "set" | "sort">,
): BookingDraft {
  return {
    truck: (sp.get("truck") ?? "16m3") as TruckType,
    handlers: Number(sp.get("handlers") ?? 1),
    pickupLat: Number(sp.get("pickupLat")),
    pickupLng: Number(sp.get("pickupLng")),
    pickup: sp.get("pickup") ?? "",
    deliveryLat: Number(sp.get("deliveryLat")),
    deliveryLng: Number(sp.get("deliveryLng")),
    delivery: sp.get("delivery") ?? "",
    phone: sp.get("phone") ?? "",
    comment: sp.get("comment") ?? "",
  }
}

function BookingContent() {
  const sp = useSearchParams()
  const router = useRouter()

  // null = auth/restore en cours ; undefined = pas de draft disponible
  const [draft, setDraft] = useState<BookingDraft | null | undefined>(null)
  const [scheduledAt, setScheduledAt] = useState("")
  const [scheduledTime, setScheduledTime] = useState("09:00")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // user_role est non-httpOnly — lisible depuis document.cookie
    const isLoggedIn = document.cookie.includes("user_role=")

    if (!isLoggedIn) {
      // Conserve les params dans sessionStorage avant de quitter
      if (sp.has("truck")) {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draftFromSearchParams(sp)))
      }
      router.replace("/login?redirect=/booking")
      return
    }

    // Cas 1 : arrivée directe depuis le formulaire devis (URL contient les params)
    if (sp.has("truck")) {
      const d = draftFromSearchParams(sp)
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d))
      setDraft(d)
      return
    }

    // Cas 2 : retour après login (URL vide) — restaure depuis sessionStorage
    const saved = sessionStorage.getItem(DRAFT_KEY)
    if (saved) {
      try {
        setDraft(JSON.parse(saved) as BookingDraft)
      } catch {
        setDraft(undefined)
      }
    } else {
      setDraft(undefined)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduledAt || !scheduledTime || !draft) return
    setLoading(true)
    setError(null)

    // RFC3339 avec offset local : "2026-04-20T09:00:00+02:00"
    const localOffset = -new Date().getTimezoneOffset()
    const sign = localOffset >= 0 ? "+" : "-"
    const hh = String(Math.floor(Math.abs(localOffset) / 60)).padStart(2, "0")
    const mm = String(Math.abs(localOffset) % 60).padStart(2, "0")
    const scheduledAtRFC3339 = `${scheduledAt}T${scheduledTime}:00${sign}${hh}:${mm}`

    try {
      const savedQuote = await createSavedQuote({
        pickup_address: draft.pickup,
        pickup_lat: draft.pickupLat,
        pickup_lng: draft.pickupLng,
        delivery_address: draft.delivery,
        delivery_lat: draft.deliveryLat,
        delivery_lng: draft.deliveryLng,
        volume_m3: TRUCK_VOLUME[draft.truck],
        helpers_count: draft.handlers,
        truck_type: draft.truck,
      })

      const booking = await createBooking({
        quote_id: savedQuote.id,
        scheduled_at: scheduledAtRFC3339,
        client_comment: draft.comment || undefined,
      })

      // Nettoie le draft après confirmation réussie
      sessionStorage.removeItem(DRAFT_KEY)
      window.location.href = `/booking/payment?id=${booking.id}`
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          router.push("/login?redirect=/booking")
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

  // Auth/restore en cours
  if (draft === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Aucun draft disponible (arrivée directe sans params ni sessionStorage)
  if (draft === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-muted-foreground">
          Aucune demande de transport en cours.
        </p>
        <a href="/#devis" className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Faire un devis
        </a>
      </div>
    )
  }

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
                <p className="line-clamp-2 font-medium">{draft.pickup || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Arrivée</p>
                <p className="line-clamp-2 font-medium">{draft.delivery || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Camion</p>
                <p className="font-medium">{draft.truck}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Manutentionnaires</p>
                <p className="font-medium">
                  {draft.handlers === 0 ? "Aucun" : draft.handlers}
                </p>
              </div>
              {draft.phone && (
                <div>
                  <p className="text-xs text-muted-foreground">Téléphone</p>
                  <p className="font-medium">{draft.phone}</p>
                </div>
              )}
              {draft.comment && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Commentaire</p>
                  <p className="font-medium">{draft.comment}</p>
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

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
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
