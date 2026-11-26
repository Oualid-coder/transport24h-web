import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Package } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Booking } from "@/lib/types"
import { BookingCardClient } from "@/components/BookingCardClient"
import { clientIpHeaders } from "@/lib/client-ip"
import { BookingsReport } from "@/components/BookingsReport"
import { RefreshLoadError } from "@/components/LoadError"
import { loadServerList, sessionRedirectUrl, type ListLoad } from "@/lib/list-load"

const DASHBOARD_PATH = "/dashboard"

// 401 (jeton expiré ou session révoquée) → /session, qui renouvelle puis revient ici ;
// 403, 404, 5xx, réseau, délai → encadré d'erreur (jamais une liste vide trompeuse).
async function getMyBookings(): Promise<ListLoad<Booking>> {
  const cookieStore = await cookies()
  const token = cookieStore.get("access_token")?.value
  if (!token) redirect(sessionRedirectUrl(DASHBOARD_PATH))

  return loadServerList<Booking>(
    `${process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL}/bookings/me`,
    // Go auth middleware lit Authorization: Bearer, pas Cookie ; IP du visiteur pour la gateway
    { Authorization: `Bearer ${token}`, ...clientIpHeaders(await headers()) },
    "Impossible de charger vos courses.",
  )
}


export default async function DashboardPage() {
  const load = await getMyBookings()
  if (load.kind === "session") redirect(sessionRedirectUrl(DASHBOARD_PATH))
  const bookings = load.kind === "ok" ? load.items : []
  // Compte entreprise (cookie user_role posé au login) : relevé des courses de l'entreprise.
  // L'API refuse /b2b/* à tout autre rôle : le cookie ne sert qu'à l'affichage.
  const isB2b = (await cookies()).get("user_role")?.value === "b2b"

  const upcoming = bookings.filter((b) =>
    ["awaiting_payment", "payment_processing", "payment_failed", "pending_review", "confirmed", "assigned"].includes(b.status),
  )
  const history = bookings.filter((b) =>
    ["done", "cancelled"].includes(b.status),
  )

  return (
    <>
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">Mon espace</h1>
      <p className="mb-8 text-muted-foreground">
        Retrouvez vos courses à venir et votre historique.{" "}
        <Link href="/dashboard/password" className="text-primary underline-offset-4 hover:underline max-lg:inline-block max-lg:py-3">
          Changer mon mot de passe
        </Link>
      </p>

      {load.kind === "error" ? (
        <RefreshLoadError title="Liste indisponible" message={load.message} retryable={load.retryable} />
      ) : (
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
      )}
    </div>

    {/* Tableau large : conteneur plus large que la liste des courses */}
    {isB2b && (
      <div className="mx-auto max-w-6xl px-4 pb-10">
        <BookingsReport target={{ view: "company" }} title="Mes courses et historique" />
      </div>
    )}
    </>
  )
}
