"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  Truck,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  acceptBooking,
  getAvailableBookings,
  getDriverMyBookings,
  ApiError,
} from "@/lib/api"
import type { AvailableBooking, Booking, BookingStatus } from "@/lib/types"

// ── Constantes ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_review: "En attente",
  confirmed: "Confirmé",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
}

const STATUS_VARIANT: Record<
  BookingStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending_review: "secondary",
  confirmed: "default",
  in_progress: "default",
  completed: "outline",
  cancelled: "destructive",
}

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Carte course disponible ───────────────────────────────────────────────────

const AVAILABLE_KEY = ["driver-available"]
const MY_KEY = ["driver-my-bookings"]

function AvailableBookingCard({ booking }: { booking: AvailableBooking }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => acceptBooking(booking.id),

    // Retrait optimiste dès le clic — avant même la réponse réseau
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: AVAILABLE_KEY })
      const snapshot = queryClient.getQueryData<AvailableBooking[]>(AVAILABLE_KEY)
      queryClient.setQueryData<AvailableBooking[]>(AVAILABLE_KEY, (old) =>
        old?.filter((b) => b.id !== booking.id),
      )
      return { snapshot }
    },

    // Succès — rafraîchit la liste "Mes missions"
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_KEY })
    },

    // Échec — rollback vers le snapshot + message selon le code HTTP
    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(AVAILABLE_KEY, context.snapshot)
      }
    },
  })

  const date = new Date(booking.scheduled_at)
  const is409 =
    mutation.isError &&
    mutation.error instanceof ApiError &&
    mutation.error.status === 409

  return (
    <Card className={mutation.isError && !is409 ? "border-destructive/40" : ""}>
      <CardContent className="space-y-4 pt-4">
        {/* Date */}
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="size-4 text-primary" />
          {date.toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}{" "}
          à{" "}
          {date.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>

        {/* Adresses */}
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

        {/* Détails */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Truck className="size-3.5" />
            {booking.truck_type}
          </span>
          {booking.helpers_count > 0 && (
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {booking.helpers_count} manutentionnaire
              {booking.helpers_count > 1 ? "s" : ""}
            </span>
          )}
          <span>{booking.distance_km.toFixed(0)} km</span>
          <span>{booking.volume_m3} m³</span>
        </div>

        {/* Prix + bouton */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-lg font-bold text-primary">
            {fmt(booking.price_ht)} € HT
          </span>
          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 size-3.5" />
            )}
            Accepter la mission
          </Button>
        </div>

        {/* Erreur 409 — course prise par un autre chauffeur */}
        {is409 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            Cette course vient d&apos;être prise par un autre chauffeur.
          </div>
        )}

        {/* Autre erreur */}
        {mutation.isError && !is409 && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            Une erreur est survenue. Veuillez réessayer.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Carte mission assignée ────────────────────────────────────────────────────

function MyMissionCard({ booking }: { booking: Booking }) {
  const date = new Date(booking.scheduled_at)
  return (
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
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DriverDashboardPage() {
  const { data: available = [], isLoading: loadingAvailable } = useQuery({
    queryKey: AVAILABLE_KEY,
    queryFn: getAvailableBookings,
    refetchInterval: 20_000, // polling court — les courses partent vite
  })

  const { data: myBookings = [], isLoading: loadingMine } = useQuery({
    queryKey: MY_KEY,
    queryFn: getDriverMyBookings,
    refetchInterval: 60_000,
  })

  const upcoming = myBookings
    .filter((b) => ["confirmed", "in_progress"].includes(b.status))
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    )

  const past = myBookings
    .filter((b) => ["completed", "cancelled"].includes(b.status))
    .sort(
      (a, b) =>
        new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
    )

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8">
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

      {/* ── Courses disponibles ─────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Courses disponibles
          </h2>
          {available.length > 0 && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
              {available.length}
            </span>
          )}
        </div>

        {loadingAvailable ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : available.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <Package className="mx-auto mb-2 size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Aucune course disponible pour l&apos;instant.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Les nouvelles missions apparaissent automatiquement.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {available
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.scheduled_at).getTime() -
                  new Date(b.scheduled_at).getTime(),
              )
              .map((b) => (
                <AvailableBookingCard key={b.id} booking={b} />
              ))}
          </div>
        )}
      </section>

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
        ) : upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
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
