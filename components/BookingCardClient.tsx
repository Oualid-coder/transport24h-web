"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Calendar, Clock, CreditCard, MapPin, Package, Pencil } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Booking, BookingStatus } from "@/lib/types"
import { EditAddressModal } from "@/components/EditAddressModal"

export const STATUS_LABEL: Record<BookingStatus, string> = {
  awaiting_payment: "En attente de paiement",
  payment_failed: "Paiement échoué",
  pending_review: "En attente",
  confirmed: "Confirmé",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
}

export const STATUS_VARIANT: Record<
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

const MODIFIABLE_STATUSES = new Set<BookingStatus>([
  "awaiting_payment",
  "pending_review",
  "confirmed",
  "in_progress",
])

function canEditAddress(booking: Booking): boolean {
  return (
    MODIFIABLE_STATUSES.has(booking.status) &&
    new Date(booking.scheduled_at) > new Date()
  )
}

export function BookingCardClient({ booking }: { booking: Booking }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const date = new Date(booking.scheduled_at)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-sm font-medium">
              Transport #{booking.id.slice(0, 8)}
            </CardTitle>
            <CardDescription className="flex items-center gap-1">
              <Calendar className="size-3" />
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
            </CardDescription>
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
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="size-3" />
            {booking.truck_type}
          </span>
          {booking.helpers_count > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {booking.helpers_count} manutentionnaire
              {booking.helpers_count > 1 ? "s" : ""}
            </span>
          )}
          <span className="ml-auto font-medium text-foreground">
            {booking.price_ht.toFixed(2)} € HT
          </span>
        </div>

        {booking.status === "awaiting_payment" && (
          <Link
            href={`/booking/payment?id=${booking.id}`}
            className={buttonVariants({ size: "sm", className: "w-full" })}
          >
            <CreditCard className="mr-2 size-3.5" />
            Reprendre le paiement
          </Link>
        )}
        {booking.status === "payment_failed" && (
          <Link
            href={`/booking/payment?id=${booking.id}`}
            className={buttonVariants({
              variant: "destructive",
              size: "sm",
              className: "w-full",
            })}
          >
            <CreditCard className="mr-2 size-3.5" />
            Mettre à jour mon paiement
          </Link>
        )}

        {canEditAddress(booking) && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-2 size-3.5" />
            Modifier l&apos;adresse
          </Button>
        )}
      </CardContent>

      <EditAddressModal
        key={editOpen ? `${booking.id}-open` : `${booking.id}-closed`}
        open={editOpen}
        booking={booking}
        onClose={() => setEditOpen(false)}
        onUpdated={() => {
          setEditOpen(false)
          router.refresh()
        }}
      />
    </Card>
  )
}
