"use client"

import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { Calendar, CreditCard, Lock, Loader2, MapPin, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createSetupIntent, confirmSetupIntent, getBookingById, ApiError } from "@/lib/api"
import type { Booking } from "@/lib/types"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "")

const STRIPE_ELEMENT_STYLE = {
  base: {
    color: "#111827",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
    fontSize: "14px",
    iconColor: "#6b7280",
    "::placeholder": { color: "#9ca3af" },
  },
  invalid: { color: "#ef4444", iconColor: "#ef4444" },
}

function StripeFieldWrapper({
  children,
  hasError,
}: {
  children: React.ReactNode
  hasError?: boolean
}) {
  return (
    <div
      className={`rounded-md border bg-background px-3 py-2.5 transition-colors ${hasError ? "border-destructive" : "border-input"}`}
    >
      {children}
    </div>
  )
}

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
  const [cardholderName, setCardholderName] = useState("")
  const [nameTouched, setNameTouched] = useState(false)
  const [numberComplete, setNumberComplete] = useState(false)
  const [expiryComplete, setExpiryComplete] = useState(false)
  const [cvcComplete, setCvcComplete] = useState(false)
  const [numberError, setNumberError] = useState<string | null>(null)
  const [expiryError, setExpiryError] = useState<string | null>(null)
  const [cvcError, setCvcError] = useState<string | null>(null)

  const stripeReady = !!stripe && !!elements
  const allComplete =
    numberComplete &&
    expiryComplete &&
    cvcComplete &&
    cardholderName.trim().length > 0

  const priceTTC = Math.round(booking.price_ht * 1.2 * 100) / 100

  const scheduledDate = new Date(booking.scheduled_at).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const nameError = nameTouched && cardholderName.trim().length === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (!stripe || !elements) {
      setError("Le formulaire de paiement n'est pas encore prêt. Veuillez patienter.")
      return
    }

    setLoading(true)
    setError(null)

    const cardNumber = elements.getElement(CardNumberElement)
    if (!cardNumber) {
      setError("Une erreur inattendue est survenue. Veuillez recharger la page.")
      setLoading(false)
      return
    }

    const { setupIntent, error: stripeErr } = await stripe.confirmCardSetup(
      clientSecret,
      {
        payment_method: {
          card: cardNumber,
          billing_details: { name: cardholderName.trim() },
        },
      },
    )

    if (stripeErr) {
      setError(stripeErr.message ?? "Erreur lors de la validation de la carte.")
      setLoading(false)
      return
    }

    const pm = setupIntent?.payment_method
    let pmId: string | undefined
    if (typeof pm === "string") pmId = pm
    else if (pm && "id" in pm) pmId = pm.id

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
          <CardContent className="space-y-4">
            {!stripeReady ? (
              <div className="space-y-3" aria-busy="true" aria-label="Chargement du formulaire de paiement">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
                  <div className="h-10 animate-pulse rounded-md bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
                  <div className="h-10 animate-pulse rounded-md bg-muted" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-10 animate-pulse rounded-md bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-10 animate-pulse rounded-md bg-muted" />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Nom du titulaire */}
                <div className="space-y-1.5">
                  <Label htmlFor="cardholder-name" className="text-xs">
                    Nom du titulaire
                  </Label>
                  <Input
                    id="cardholder-name"
                    type="text"
                    placeholder="Jean Dupont"
                    autoComplete="cc-name"
                    value={cardholderName}
                    aria-invalid={nameError}
                    onChange={(e) => setCardholderName(e.target.value)}
                    onBlur={() => setNameTouched(true)}
                  />
                  {nameError && (
                    <p className="text-xs text-destructive">
                      Le nom du titulaire est requis.
                    </p>
                  )}
                </div>

                {/* Numéro de carte */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Numéro de carte</Label>
                  <StripeFieldWrapper hasError={!!numberError}>
                    <CardNumberElement
                      options={{ style: STRIPE_ELEMENT_STYLE, showIcon: true }}
                      onChange={(e) => {
                        setNumberComplete(e.complete)
                        setNumberError(e.error?.message ?? null)
                      }}
                    />
                  </StripeFieldWrapper>
                  {numberError && (
                    <p className="text-xs text-destructive">{numberError}</p>
                  )}
                </div>

                {/* Expiration + CVC */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date d&apos;expiration</Label>
                    <StripeFieldWrapper hasError={!!expiryError}>
                      <CardExpiryElement
                        options={{ style: STRIPE_ELEMENT_STYLE }}
                        onChange={(e) => {
                          setExpiryComplete(e.complete)
                          setExpiryError(e.error?.message ?? null)
                        }}
                      />
                    </StripeFieldWrapper>
                    {expiryError && (
                      <p className="text-xs text-destructive">{expiryError}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Code de sécurité</Label>
                    <StripeFieldWrapper hasError={!!cvcError}>
                      <CardCvcElement
                        options={{ style: STRIPE_ELEMENT_STYLE }}
                        onChange={(e) => {
                          setCvcComplete(e.complete)
                          setCvcError(e.error?.message ?? null)
                        }}
                      />
                    </StripeFieldWrapper>
                    {cvcError && (
                      <p className="text-xs text-destructive">{cvcError}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Info débit différé */}
        <div className="flex items-start gap-2.5 rounded-lg border border-green/20 bg-green-light px-4 py-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Aucun débit immédiat.</span>{" "}
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
          disabled={loading || !stripeReady || !allComplete}
        >
          {loading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : allComplete ? (
            <CreditCard className="mr-2 size-4" />
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
    if (!bookingId) return

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

  const displayError = !bookingId ? "Identifiant de réservation manquant." : fetchError

  if (displayError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {displayError}
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
