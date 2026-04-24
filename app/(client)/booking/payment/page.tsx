"use client"

import { loadStripe } from "@stripe/stripe-js"
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Calendar, CreditCard, Lock, Loader2, MapPin, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createSetupIntent, confirmSetupIntent, getBookingById, ApiError } from "@/lib/api"
import type { Booking } from "@/lib/types"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "")

// ── Formulaire Stripe (doit être enfant de <Elements>) ────────────────────────

function CheckoutForm({
  booking,
  clientSecret,
}: {
  booking: Booking
  clientSecret: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => obs.disconnect()
  }, [])

  const priceTTC = Math.round(booking.price_ht * 1.2 * 100) / 100

  const scheduledDate = new Date(booking.scheduled_at).toLocaleDateString(
    "fr-FR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)

    const card = elements.getElement(CardElement)
    if (!card) {
      setLoading(false)
      return
    }

    const { setupIntent, error: stripeErr } = await stripe.confirmCardSetup(
      clientSecret,
      { payment_method: { card } },
    )

    if (stripeErr) {
      setError(stripeErr.message ?? "Erreur lors de la validation de la carte.")
      setLoading(false)
      return
    }

    const pm = setupIntent?.payment_method
    let pmId: string | undefined
    if (typeof pm === "string") {
      pmId = pm
    } else if (pm && "id" in pm) {
      pmId = pm.id
    }

    if (!pmId) {
      setError("Impossible de récupérer la méthode de paiement.")
      setLoading(false)
      return
    }

    try {
      await confirmSetupIntent(booking.id, pmId)
      router.push(`/booking/confirmation?id=${booking.id}`)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue. Veuillez réessayer.",
      )
      setLoading(false)
    }
  }

  const cardOptions = {
    style: {
      base: {
        color: isDark ? "#e5e7eb" : "#111827",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        fontSize: "14px",
        iconColor: isDark ? "#9ca3af" : "#6b7280",
        "::placeholder": { color: isDark ? "#4b5563" : "#9ca3af" },
      },
      invalid: { color: "#ef4444", iconColor: "#ef4444" },
    },
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold">Sécuriser votre réservation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Référence{" "}
          <span className="font-mono font-semibold text-foreground">
            {booking.reference}
          </span>
        </p>
      </div>

      {/* Résumé */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="size-4 text-primary" />
            Détails de la course
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Départ</p>
              <p className="font-medium">{booking.pickup_address}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Arrivée</p>
              <p className="font-medium">{booking.delivery_address}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
            <p className="font-medium capitalize">{scheduledDate}</p>
          </div>
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Montant TTC (TVA 20 %)</span>
              <span className="text-lg font-bold">{priceTTC.toFixed(2)} €</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulaire carte */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="size-4 text-primary" />
              Coordonnées bancaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-input bg-background px-3 py-2.5">
              <CardElement options={cardOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Info débit différé */}
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-blue-500" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Aucun débit immédiat.
            </span>{" "}
            Votre carte sera débitée de{" "}
            <span className="font-medium text-foreground">
              {priceTTC.toFixed(2)} €
            </span>{" "}
            uniquement 24h avant votre transport.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading || !stripe || !elements}
        >
          {loading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Lock className="mr-2 size-4" />
          )}
          Enregistrer ma carte
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Paiement sécurisé par{" "}
          <span className="font-semibold text-foreground">Stripe</span>
        </p>
      </form>
    </div>
  )
}

// ── Contenu principal (fetchs + rendu Elements) ───────────────────────────────

function PaymentContent() {
  const sp = useSearchParams()
  const bookingId = sp.get("id") ?? ""

  const [booking, setBooking] = useState<Booking | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!bookingId) {
      setFetchError("Identifiant de réservation manquant.")
      return
    }

    Promise.all([getBookingById(bookingId), createSetupIntent(bookingId)])
      .then(([b, si]) => {
        setBooking(b)
        setClientSecret(si.client_secret)
      })
      .catch((err) => {
        setFetchError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger la page de paiement.",
        )
      })
  }, [bookingId])

  if (fetchError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </p>
      </div>
    )
  }

  if (!booking || !clientSecret) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm booking={booking} clientSecret={clientSecret} />
    </Elements>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  )
}
