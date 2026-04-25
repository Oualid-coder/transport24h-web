"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  Euro,
  Loader2,
  MapPin,
  MessageSquare,
  PencilLine,
  Truck,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  assignDriver,
  confirmBooking,
  getAdminBookings,
  getAdminDrivers,
  getAdminStats,
  updateBookingPrice,
  ApiError,
} from "@/lib/api"
import type {
  AdminStats,
  BookingStatus,
  BookingWithClient,
  Driver,
  PaymentStatus,
} from "@/lib/types"
import { BackButton } from "@/components/BackButton"

// ── Constantes d'affichage ───────────────────────────────────────────────────

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

const PAYMENT_CONFIG: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  paid: {
    label: "Payé",
    className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  },
  pending: {
    label: "Paiement en attente",
    className: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  },
  none: {
    label: "Non payé",
    className: "border-border bg-muted text-muted-foreground",
  },
}

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Modal assignation chauffeur ───────────────────────────────────────────────

function AssignDriverModal({
  bookingId,
  queryKey,
  onClose,
}: {
  bookingId: string
  queryKey: unknown[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: getAdminDrivers,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: (driverId: string) => assignDriver(bookingId, driverId),
    onSuccess: (updated) => {
      queryClient.setQueryData<BookingWithClient[]>(queryKey, (old) =>
        old?.map((b) => (b.id === updated.id ? updated : b)),
      )
      setMsg({ type: "success", text: "Chauffeur assigné avec succès." })
      setTimeout(onClose, 1500)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setMsg({ type: "error", text: "Ce chauffeur est déjà assigné à cette course." })
      } else {
        setMsg({ type: "error", text: "Une erreur est survenue. Veuillez réessayer." })
      }
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !mutation.isPending && onClose()}
      />

      {/* Panneau */}
      <div className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">Assigner un chauffeur</h2>
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Liste chauffeurs */}
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : drivers.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucun chauffeur disponible.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {drivers.map((driver: Driver) => (
                <li
                  key={driver.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent/30"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {driver.first_name} {driver.last_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {driver.email}
                      {driver.phone ? ` · ${driver.phone}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(driver.id)}
                    className="shrink-0"
                  >
                    {mutation.isPending && mutation.variables === driver.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      "Assigner"
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Message retour */}
        {msg && (
          <div
            className={`border-t border-border px-5 py-3 text-sm ${
              msg.type === "success"
                ? "text-emerald-400"
                : "text-destructive"
            }`}
          >
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Carte Stats ───────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value: string
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <div className="mt-1 h-7 w-20 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-2xl font-bold tabular-nums">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Carte Booking ─────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  queryKey,
}: {
  booking: BookingWithClient
  queryKey: unknown[]
}) {
  const queryClient = useQueryClient()
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState(fmt(booking.price_ht))
  const [assignOpen, setAssignOpen] = useState(false)

  const priceTVA = booking.price_ttc - booking.price_ht

  const priceMutation = useMutation({
    mutationFn: (ht: number) => updateBookingPrice(booking.id, ht),
    onSuccess: (updated) => {
      setEditingPrice(false)
      queryClient.setQueryData<BookingWithClient[]>(queryKey, (old) =>
        old?.map((b) => (b.id === updated.id ? updated : b)),
      )
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmBooking(booking.id),
    onSuccess: (updated) => {
      queryClient.setQueryData<BookingWithClient[]>(queryKey, (old) =>
        old?.map((b) => (b.id === updated.id ? updated : b)),
      )
    },
  })

  const date = new Date(booking.scheduled_at)
  const payment = PAYMENT_CONFIG[booking.payment_status]

  return (
    <>
      <Card className="overflow-hidden">
        {/* ── En-tête ─────────────────────────────────────────────────────── */}
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="font-mono text-xs text-muted-foreground">
                #{booking.id.slice(0, 8).toUpperCase()}
              </p>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Calendar className="size-3.5 text-primary" />
                {date.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {" à "}
                {date.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={STATUS_VARIANT[booking.status]}>
                {STATUS_LABEL[booking.status]}
              </Badge>
              <Badge className={payment.className}>
                {booking.payment_status === "paid" && (
                  <CreditCard className="mr-1 size-3" />
                )}
                {payment.label}
                {booking.last4 ? ` ·· ${booking.last4}` : ""}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Client ──────────────────────────────────────────────────── */}
          <div className="flex items-start gap-3 rounded-lg bg-accent/40 px-3 py-2.5">
            <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {booking.client_first_name} {booking.client_last_name}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {booking.client_email}
                {booking.client_phone ? ` · ${booking.client_phone}` : ""}
              </p>
            </div>
          </div>

          {/* ── Adresses ────────────────────────────────────────────────── */}
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

          {/* ── Détails transport ───────────────────────────────────────── */}
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

          {/* ── Commentaire client ──────────────────────────────────────── */}
          {booking.client_comment && (
            <div className="flex gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 text-sm">
              <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground italic">
                &ldquo;{booking.client_comment}&rdquo;
              </p>
            </div>
          )}

          {/* ── Prix ────────────────────────────────────────────────────── */}
          <div className="rounded-lg bg-accent/40 px-3 py-2.5">
            {editingPrice ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    className="h-7 w-32 text-sm"
                    autoFocus
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
                  onClick={() => {
                    setEditingPrice(false)
                    setPriceInput(fmt(booking.price_ht))
                  }}
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-4 text-sm">
                  <span className="text-muted-foreground">
                    HT{" "}
                    <span className="font-medium text-foreground">
                      {fmt(booking.price_ht)} €
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    TVA{" "}
                    <span className="font-medium text-foreground">
                      {fmt(priceTVA)} €
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    TTC{" "}
                    <span className="text-base font-bold text-primary">
                      {fmt(booking.price_ttc)} €
                    </span>
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  onClick={() => setEditingPrice(true)}
                  title="Modifier le prix"
                >
                  <PencilLine className="size-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* ── Actions ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {booking.status === "pending_review" && (
              <Button
                size="sm"
                className="flex-1"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 size-3.5" />
                )}
                Confirmer
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setAssignOpen(true)}
            >
              <UserPlus className="mr-1.5 size-3.5" />
              Assigner un chauffeur
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal rendu en dehors de la Card pour éviter les problèmes de z-index */}
      {assignOpen && (
        <AssignDriverModal
          bookingId={booking.id}
          queryKey={queryKey}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </>
  )
}

// ── Liste bookings ────────────────────────────────────────────────────────────

function BookingList({ status }: { status?: string }) {
  const queryKey = ["admin-bookings", status ?? "all"]

  const { data: bookings = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getAdminBookings(status),
    refetchInterval: 30_000,
  })

  const sorted = [...bookings].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucune réservation.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {sorted.map((b) => (
        <BookingCard key={b.id} booking={b} queryKey={queryKey} />
      ))}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-8">
      <BackButton href="/" />
      {/* En-tête */}
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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Euro className="size-5 text-primary" />}
          label="CA aujourd'hui (HT)"
          value={stats ? `${fmt(stats.revenue_today)} €` : "—"}
          loading={statsLoading}
        />
        <StatCard
          icon={<Truck className="size-5 text-primary" />}
          label="Courses aujourd'hui"
          value={stats ? String(stats.bookings_today) : "—"}
          loading={statsLoading}
        />
        <StatCard
          icon={<Loader2 className="size-5 text-amber-400" />}
          label="En attente de validation"
          value={stats ? String(stats.pending_count) : "—"}
          loading={statsLoading}
        />
        <StatCard
          icon={<CreditCard className="size-5 text-emerald-400" />}
          label="Paiements reçus"
          value={stats ? String(stats.paid_count) : "—"}
          loading={statsLoading}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Toutes les courses</TabsTrigger>
          <TabsTrigger value="pending">
            <span className="flex items-center gap-1.5">
              À valider
              {stats && stats.pending_count > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
                  {stats.pending_count}
                </span>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="today">Aujourd&apos;hui</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <BookingList />
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <BookingList status="pending_review" />
        </TabsContent>

        <TabsContent value="today" className="mt-6">
          <BookingList status="today" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
