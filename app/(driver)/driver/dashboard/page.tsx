import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Calendar, MapPin, Package } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Booking, BookingStatus } from "@/lib/types"

async function getDriverBookings(): Promise<Booking[]> {
  const cookieStore = await cookies()
  const token = cookieStore.get("access_token")?.value
  if (!token) redirect("/login?redirect=/driver/dashboard")

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/driver/bookings`,
    {
      // Go auth middleware lit Authorization: Bearer, pas Cookie
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  )
  if (!res.ok) return []
  return res.json() as Promise<Booking[]>
}

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

export default async function DriverDashboardPage() {
  const bookings = await getDriverBookings()

  const upcoming = bookings.filter((b) =>
    ["confirmed", "in_progress"].includes(b.status),
  )
  const past = bookings.filter((b) =>
    ["completed", "cancelled"].includes(b.status),
  )

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Mes courses</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {/* À venir */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          À venir ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <Package className="mx-auto mb-2 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Aucune course à venir.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcoming
              .sort(
                (a, b) =>
                  new Date(a.scheduled_at).getTime() -
                  new Date(b.scheduled_at).getTime(),
              )
              .map((b) => {
                const date = new Date(b.scheduled_at)
                return (
                  <Card key={b.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            #{b.id.slice(0, 8)}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <Calendar className="size-3" />
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
                          </CardDescription>
                        </div>
                        <Badge variant={STATUS_VARIANT[b.status]}>
                          {STATUS_LABEL[b.status]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex gap-2">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground line-clamp-2">
                          {b.pickup_address}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                        <span className="text-muted-foreground line-clamp-2">
                          {b.delivery_address}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                        <span>{b.truck_type}</span>
                        {b.helpers_count > 0 && (
                          <span>
                            {b.helpers_count} manutentionnaire
                            {b.helpers_count > 1 ? "s" : ""}
                          </span>
                        )}
                        {b.client_phone && <span>{b.client_phone}</span>}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        )}
      </section>

      {/* Historique */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Historique
          </h2>
          <div className="space-y-3">
            {past.slice(0, 10).map((b) => {
              const date = new Date(b.scheduled_at)
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-muted-foreground">
                      {date.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      — {b.pickup_address.split(",")[0]} →{" "}
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
