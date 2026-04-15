import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Calendar, Clock, MapPin, Package } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Booking, BookingStatus } from "@/lib/types"

async function getMyBookings(): Promise<Booking[]> {
  const cookieStore = await cookies()
  const token = cookieStore.get("access_token")?.value
  if (!token) redirect("/login?redirect=/dashboard")

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/bookings/me`,
    {
      headers: { Cookie: `access_token=${token}` },
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

function BookingCard({ booking }: { booking: Booking }) {
  const date = new Date(booking.scheduledAt)
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
              {booking.pickupAddress}
            </span>
          </div>
          <div className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground line-clamp-1">
              {booking.deliveryAddress}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="size-3" />
            {booking.truckType}
          </span>
          {booking.handlers > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {booking.handlers} manutentionnaire{booking.handlers > 1 ? "s" : ""}
            </span>
          )}
          <span className="ml-auto font-medium text-foreground">
            {booking.priceTTC.toFixed(2)} €
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const bookings = await getMyBookings()

  const upcoming = bookings.filter((b) =>
    ["pending_review", "confirmed", "in_progress"].includes(b.status),
  )
  const history = bookings.filter((b) =>
    ["completed", "cancelled"].includes(b.status),
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">Mon espace</h1>
      <p className="mb-8 text-muted-foreground">
        Retrouvez vos courses à venir et votre historique.
      </p>

      <Tabs defaultValue="upcoming">
        <TabsList className="mb-6">
          <TabsTrigger value="upcoming">
            À venir
            {upcoming.length > 0 && (
              <span className="ml-2 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                {upcoming.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <Package className="mx-auto mb-3 size-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">Aucune course à venir.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcoming.map((b) => (
                <BookingCard key={b.id} booking={b} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <p className="text-muted-foreground">Aucun historique.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((b) => (
                <BookingCard key={b.id} booking={b} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
