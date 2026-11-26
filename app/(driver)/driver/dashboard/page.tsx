"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Calendar,
  CheckCircle2,
  Flag,
  Loader2,
  MapPin,
  Phone,
  Truck,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDriverMyBookings } from "@/lib/api"
import { DRIVER_WITHDRAWAL_MESSAGE } from "@/lib/driver-assignment"
import type { Booking, BookingStatus } from "@/lib/types"
import { BackButton } from "@/components/BackButton"
import { BookingPhotoSection } from "@/components/BookingPhotoSection"
import { CompleteBookingModal } from "@/components/CompleteBookingModal"
import { LoadError } from "@/components/LoadError"
import { canRetryLoad, loadErrorMessage } from "@/lib/list-load"

// ── Constantes ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<BookingStatus, string> = {
  awaiting_payment: "En attente de paiement",
  payment_processing: "Débit en cours",
  payment_failed: "Paiement échoué",
  pending_review: "En attente",
  confirmed: "Confirmé",
  assigned: "Chauffeur assigné",
  done: "Terminé",
  cancelled: "Annulé",
}

const STATUS_VARIANT: Record<
  BookingStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  awaiting_payment: "outline",
  payment_processing: "outline",
  payment_failed: "destructive",
  pending_review: "secondary",
  confirmed: "default",
  assigned: "default",
  done: "outline",
  cancelled: "destructive",
}

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Le chauffeur ne voit que les courses qui lui sont affectées : seul l'admin
// voit les courses non affectées et les affecte.
const MY_KEY = ["driver-my-bookings"]

// ── Carte mission assignée ────────────────────────────────────────────────────

function MyMissionCard({ booking }: { booking: Booking }) {
  const queryClient = useQueryClient()
  const [completeOpen, setCompleteOpen] = useState(false)
  const date = new Date(booking.scheduled_at)

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-medium">
                #{booking.id.slice(0, 8).toUpperCase()}
              </CardTitle>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="size-3" />
                {date.toLocaleDateString("fr-FR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                à{" "}
                {date.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[booking.status]}>
              {STATUS_LABEL[booking.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="line-clamp-1 text-muted-foreground">
                {booking.pickup_address}
              </span>
            </div>
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
              <span className="line-clamp-1 text-muted-foreground">
                {booking.delivery_address}
              </span>
            </div>
          </div>
          {booking.client_phone && (
            <a
              href={`tel:${booking.client_phone}`}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline max-lg:min-h-11"
            >
              <Phone className="size-3.5 shrink-0" />
              {booking.client_phone}
            </a>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Truck className="size-3.5" />
              {booking.truck_type}
            </span>
            {booking.helpers_count > 0 && (
              <span className="flex items-center gap-1">
                <Users className="size-3.5" />
                {booking.helpers_count} manut.
              </span>
            )}
            <span className="ml-auto font-medium text-foreground">
              {fmt(booking.price_ht)} € HT
            </span>
          </div>
          {booking.status === "assigned" && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => setCompleteOpen(true)}
            >
              <Flag className="mr-2 size-3.5" />
              Terminer la course
            </Button>
          )}
          {/* Pas de désistement en ligne : seul l'admin désaffecte une course. */}
          {booking.status === "assigned" && (
            <p className="text-xs text-muted-foreground">
              {DRIVER_WITHDRAWAL_MESSAGE}{" "}
              <Link href="/contact" className="font-medium text-foreground underline underline-offset-2">
                formulaire de contact
              </Link>
              {" ou "}
              <a
                href="mailto:contact@transport24h.fr"
                className="font-medium text-foreground underline underline-offset-2"
              >
                contact@transport24h.fr
              </a>
              .
            </p>
          )}
          <BookingPhotoSection
            bookingId={booking.id}
            variant="driver"
            canUploadAfter={["assigned", "done"].includes(booking.status)}
          />
        </CardContent>
      </Card>

      <CompleteBookingModal
        open={completeOpen}
        bookingId={booking.id}
        onClose={() => setCompleteOpen(false)}
        onCompleted={() => {
          setCompleteOpen(false)
          queryClient.invalidateQueries({ queryKey: MY_KEY })
        }}
      />
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DriverDashboardPage() {
  const {
    data: myBookings = [],
    isLoading: loadingMine,
    error: mineError,
    refetch: refetchMine,
    isFetching: fetchingMine,
  } = useQuery({
    queryKey: MY_KEY,
    queryFn: getDriverMyBookings,
    refetchInterval: 60_000,
  })

  const upcoming = myBookings
    .filter((b) => b.status === "assigned")
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    )

  const past = myBookings
    .filter((b) => ["done", "cancelled"].includes(b.status))
    .sort(
      (a, b) =>
        new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
    )

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <BackButton href="/" />
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* ── Mes missions ────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Mes missions à venir
          {upcoming.length > 0 && (
            <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
              {upcoming.length}
            </span>
          )}
        </h2>

        {loadingMine ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : mineError && myBookings.length === 0 ? (
          <LoadError
            title="Liste indisponible"
            message={loadErrorMessage(mineError, "Impossible de charger vos missions.")}
            onRetry={canRetryLoad(mineError) ? () => void refetchMine() : undefined}
            retrying={fetchingMine}
          />
        ) : upcoming.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <CheckCircle2 className="mx-auto mb-2 size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Aucune mission assignée.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((b) => (
              <MyMissionCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>

      {/* ── Historique ──────────────────────────────────────────────────── */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Historique
          </h2>
          <div className="space-y-2">
            {past.slice(0, 10).map((b) => {
              const date = new Date(b.scheduled_at)
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-muted-foreground">
                      {date.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      —{" "}
                      {b.pickup_address.split(",")[0]}
                      {" → "}
                      {b.delivery_address.split(",")[0]}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[b.status]}>
                    {STATUS_LABEL[b.status]}
                  </Badge>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
