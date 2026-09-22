import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Package } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Booking } from "@/lib/types"
import { BookingCardClient } from "@/components/BookingCardClient"

async function getMyBookings(): Promise<Booking[]> {
  const cookieStore = await cookies()
  const token = cookieStore.get("access_token")?.value
  if (!token) redirect("/login?redirect=/dashboard")

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/bookings/me`,
    {
      // Go auth middleware lit Authorization: Bearer, pas Cookie
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  )
  if (!res.ok) return []
  return res.json() as Promise<Booking[]>
}


export default async function DashboardPage() {
  const bookings = await getMyBookings()

  const upcoming = bookings.filter((b) =>
    ["awaiting_payment", "payment_failed", "pending_review", "confirmed", "in_progress"].includes(b.status),
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
                <BookingCardClient key={b.id} booking={b} />
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
                <BookingCardClient key={b.id} booking={b} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
