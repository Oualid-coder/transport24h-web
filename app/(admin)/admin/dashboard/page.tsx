"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  PencilLine,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  confirmBooking,
  getBookingsToday,
  getPendingReviewBookings,
  updateBookingPrice,
} from "@/lib/api"
import type { Booking, BookingStatus } from "@/lib/types"

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_review: "À valider",
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

// ── Carte de réservation avec édition de prix ────────────────────────────────

function BookingReviewCard({ booking }: { booking: Booking }) {
  const queryClient = useQueryClient()
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState(
    String(booking.price_ht.toFixed(2)),
  )

  const priceMutation = useMutation({
    mutationFn: (priceHT: number) => updateBookingPrice(booking.id, priceHT),
    onSuccess: () => {
      setEditingPrice(false)
      queryClient.invalidateQueries({ queryKey: ["bookings-pending"] })
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmBooking(booking.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings-pending"] })
      queryClient.invalidateQueries({ queryKey: ["bookings-today"] })
    },
  })

  const date = new Date(booking.scheduled_at)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-medium">
              #{booking.id.slice(0, 8)}
            </CardTitle>
            <CardDescription className="flex items-center gap-1">
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
            </CardDescription>
          </div>
          <Badge variant={STATUS_VARIANT[booking.status]}>
            {STATUS_LABEL[booking.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-muted-foreground line-clamp-1">
              {booking.pickup_address}
            </span>
          </div>
          <div className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground line-clamp-1">
              {booking.delivery_address}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{booking.truck_type}</span>
          {booking.helpers_count > 0 && (
            <span>
              {booking.helpers_count} manutentionnaire
              {booking.helpers_count > 1 ? "s" : ""}
            </span>
          )}
          {booking.client_phone && (
            <span className="text-muted-foreground/60">{booking.client_phone}</span>
          )}
        </div>

        {/* Prix éditable */}
        <div className="flex items-center gap-3 rounded-lg bg-accent/50 px-3 py-2">
          {editingPrice ? (
            <>
              <div className="flex flex-1 items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="h-7 w-28 text-sm"
                />
                <span className="text-xs text-muted-foreground">€ HT</span>
              </div>
              <Button
                size="sm"
                className="h-7"
                disabled={priceMutation.isPending}
                onClick={() => priceMutation.mutate(parseFloat(priceInput))}
              >
                {priceMutation.isPending && (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                )}
                Sauver
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => setEditingPrice(false)}
              >
                Annuler
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm font-medium text-primary">
                {booking.price_ht.toFixed(2)} € HT
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => setEditingPrice(true)}
                title="Modifier le prix"
              >
                <PencilLine className="size-3.5" />
              </Button>
            </>
          )}
        </div>

        {booking.status === "pending_review" && (
          <Button
            className="w-full"
            disabled={confirmMutation.isPending}
            onClick={() => confirmMutation.mutate()}
          >
            {confirmMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 size-4" />
            )}
            Confirmer la réservation
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// ── Carte courses du jour ────────────────────────────────────────────────────

function TodayBookingCard({ booking }: { booking: Booking }) {
  const date = new Date(booking.scheduled_at)
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-card p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Package className="size-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {date.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" — "}
          <span className="text-muted-foreground">
            {booking.pickup_address.split(",")[0]}
          </span>
          {" → "}
          <span className="text-muted-foreground">
            {booking.delivery_address.split(",")[0]}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {booking.truck_type}
          {booking.client_phone ? ` · ${booking.client_phone}` : ""}
        </p>
      </div>
      <Badge variant={STATUS_VARIANT[booking.status]}>
        {STATUS_LABEL[booking.status]}
      </Badge>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { data: todayBookings = [], isLoading: loadingToday } = useQuery({
    queryKey: ["bookings-today"],
    queryFn: getBookingsToday,
    refetchInterval: 60_000,
  })

  const { data: pendingBookings = [], isLoading: loadingPending } = useQuery({
    queryKey: ["bookings-pending"],
    queryFn: getPendingReviewBookings,
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Courses aujourd&apos;hui
              </p>
              <p className="text-2xl font-bold">{todayBookings.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
              <Package className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                En attente de validation
              </p>
              <p className="text-2xl font-bold">{pendingBookings.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <CheckCircle2 className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Confirmées aujourd&apos;hui
              </p>
              <p className="text-2xl font-bold">
                {
                  todayBookings.filter((b) => b.status === "confirmed").length
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            À valider
            {pendingBookings.length > 0 && (
              <span className="ml-2 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                {pendingBookings.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="today">Courses du jour</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {loadingPending ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : pendingBookings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <CheckCircle2 className="mx-auto mb-3 size-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">
                Aucune réservation en attente.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {pendingBookings.map((b) => (
                <BookingReviewCard key={b.id} booking={b} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="today" className="mt-6">
          {loadingToday ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : todayBookings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <p className="text-muted-foreground">
                Aucune course programmée aujourd&apos;hui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayBookings
                .sort(
                  (a, b) =>
                    new Date(a.scheduled_at).getTime() -
                    new Date(b.scheduled_at).getTime(),
                )
                .map((b) => (
                  <TodayBookingCard key={b.id} booking={b} />
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
