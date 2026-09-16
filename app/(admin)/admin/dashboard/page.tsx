"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Clock,
  CreditCard,
  Euro,
  Truck,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getAdminStats } from "@/lib/api"
import type { AdminStats } from "@/lib/types"
import { BackButton } from "@/components/BackButton"
import { BookingList } from "@/components/admin/BookingList"

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
          icon={<Clock className="size-5 text-amber-400" />}
          label="En attente de validation"
          value={stats ? String(stats.pending_count) : "—"}
          loading={statsLoading}
        />
        <StatCard
          icon={<CreditCard className="size-5 text-primary" />}
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
          <TabsTrigger value="cancelled">Annulées</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {/* cancelled et payment_failed exclus par défaut (active_only côté API) */}
          <BookingList />
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <BookingList status="pending_review" />
        </TabsContent>

        <TabsContent value="today" className="mt-6">
          {/* date=today filtre sur scheduled_at::date = CURRENT_DATE */}
          <BookingList date="today" />
        </TabsContent>

        <TabsContent value="cancelled" className="mt-6">
          <BookingList status="cancelled" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
