"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Ban,
  Calendar,
  CheckCircle2,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  PencilLine,
  RotateCcw,
  Truck,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cancelUnpaidBooking, confirmBooking, sendInvoice, updateBookingPrice, ApiError } from "@/lib/api"
import type { BookingStatus, BookingWithClient, PaginatedBookings, PaymentStatus } from "@/lib/types"
import { BookingPhotoSection } from "@/components/BookingPhotoSection"
import { AssignDriverModal } from "./AssignDriverModal"
import { RefundModal } from "./RefundModal"

// ── Constantes d'affichage ────────────────────────────────────────────────────

const STATUS_LABEL: Record<BookingStatus, string> = {
  awaiting_payment: "En attente de paiement",
  payment_failed: "Paiement échoué",
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
  awaiting_payment: "outline",
  payment_failed: "destructive",
  pending_review: "secondary",
  confirmed: "default",
  in_progress: "default",
  completed: "outline",
  cancelled: "destructive",
}

const PAYMENT_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  paid: {
    label: "Payé",
    className: "border-primary/30 bg-primary/10 text-primary",
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

// ── Composant ─────────────────────────────────────────────────────────────────

export function BookingCard({
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
  const [refundOpen, setRefundOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [invoiceMsg, setInvoiceMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const priceTVA = booking.price_ttc - booking.price_ht

  const priceMutation = useMutation({
    mutationFn: (ht: number) => updateBookingPrice(booking.id, ht),
    onSuccess: (updated) => {
      setEditingPrice(false)
      queryClient.setQueryData<PaginatedBookings>(queryKey, (old) =>
        old ? { ...old, bookings: old.bookings.map((b) => (b.id === updated.id ? updated : b)) } : old,
      )
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmBooking(booking.id),
    onSuccess: (updated) => {
      queryClient.setQueryData<PaginatedBookings>(queryKey, (old) =>
        old ? { ...old, bookings: old.bookings.map((b) => (b.id === updated.id ? updated : b)) } : old,
      )
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelUnpaidBooking(booking.id),
    onSuccess: () => {
      setCancelOpen(false)
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (err) => {
      setCancelError(
        err instanceof ApiError ? err.message : "Erreur lors de l'annulation.",
      )
    },
  })

  const sendMutation = useMutation({
    mutationFn: (invoiceId: string) => sendInvoice(invoiceId),
    onSuccess: () => {
      setInvoiceMsg({ type: "success", text: "Facture envoyée avec succès." })
    },
    onError: (err) => {
      const text =
        err instanceof ApiError ? err.message : "Erreur lors de l'envoi de la facture."
      setInvoiceMsg({ type: "error", text })
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
                {booking.client_phone && (
                  <>
                    {" · "}
                    <a
                      href={`tel:${booking.client_phone}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {booking.client_phone}
                    </a>
                  </>
                )}
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
            {booking.invoice_id && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={sendMutation.isPending}
                onClick={() => {
                  const id = booking.invoice_id
                  if (!id) return
                  setInvoiceMsg(null)
                  sendMutation.mutate(id)
                }}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Mail className="mr-1.5 size-3.5" />
                )}
                Envoyer la facture
              </Button>
            )}
            {booking.payment_status === "paid" && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-destructive hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setRefundOpen(true)}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Rembourser
              </Button>
            )}
            {booking.status === "awaiting_payment" && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-destructive hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setCancelError(null)
                  setCancelOpen(true)
                }}
              >
                <Ban className="mr-1.5 size-3.5" />
                Annuler la réservation
              </Button>
            )}
          </div>

          {/* ── Feedback envoi facture ───────────────────────────────────── */}
          {invoiceMsg && (
            <p
              className={`text-xs ${
                invoiceMsg.type === "success" ? "text-primary" : "text-destructive"
              }`}
            >
              {invoiceMsg.text}
            </p>
          )}

          {/* ── Feedback annulation ─────────────────────────────────────────── */}
          {cancelError && (
            <p className="text-xs text-destructive">{cancelError}</p>
          )}

          {/* ── Photos ──────────────────────────────────────────────────── */}
          <BookingPhotoSection bookingId={booking.id} variant="admin" />
        </CardContent>
      </Card>

      <Dialog
        open={cancelOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen && !cancelMutation.isPending) setCancelOpen(false)
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-md gap-0 overflow-hidden p-0 bg-background"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <DialogTitle className="font-semibold">
              Annuler la réservation ?
            </DialogTitle>
            <DialogClose
              render={
                <button
                  disabled={cancelMutation.isPending}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  aria-label="Fermer"
                />
              }
            >
              <X className="size-4" />
            </DialogClose>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <Ban className="mt-0.5 size-4 shrink-0" />
              <p>
                Cette réservation n&apos;a jamais été payée, elle sera{" "}
                <strong>annulée définitivement</strong>. Aucun remboursement ne
                sera effectué.
              </p>
            </div>
            {cancelError && (
              <p role="alert" className="text-xs text-destructive">
                {cancelError}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={cancelMutation.isPending}
                onClick={() => setCancelOpen(false)}
              >
                Retour
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                Confirmer l&apos;annulation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AssignDriverModal
        open={assignOpen}
        bookingId={booking.id}
        queryKey={queryKey}
        onClose={() => setAssignOpen(false)}
      />
      <RefundModal
        open={refundOpen}
        bookingId={booking.id}
        amountTTC={booking.price_ttc}
        queryKey={queryKey}
        onClose={() => setRefundOpen(false)}
      />
    </>
  )
}
