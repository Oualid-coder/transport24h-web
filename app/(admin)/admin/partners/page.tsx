"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  Truck,
  User,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { approvePartner, getAdminPartners, rejectPartner } from "@/lib/api"
import type { PartnerApplication, PartnerStatus } from "@/lib/types"

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  PartnerStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "En attente",
    className: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  },
  approved: {
    label: "Approuvé",
    className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
  },
  rejected: {
    label: "Rejeté",
    className: "border-red-500/30 bg-red-500/15 text-red-400",
  },
}

// ── Carte candidature ─────────────────────────────────────────────────────────

function PartnerCard({
  partner,
  queryKey,
}: {
  partner: PartnerApplication
  queryKey: unknown[]
}) {
  const queryClient = useQueryClient()

  const updateCache = (updated: PartnerApplication) => {
    // Met à jour la liste courante immédiatement
    queryClient.setQueryData<PartnerApplication[]>(queryKey, (old) =>
      old?.map((p) => (p.id === updated.id ? updated : p)),
    )
    // Invalide toutes les listes partenaires pour que les autres onglets soient cohérents
    queryClient.invalidateQueries({
      queryKey: ["admin-partners"],
      exact: false,
    })
  }

  const approveMutation = useMutation({
    mutationFn: () => approvePartner(partner.id),
    onSuccess: updateCache,
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectPartner(partner.id),
    onSuccess: updateCache,
  })

  const date = new Date(partner.created_at)
  const statusCfg = STATUS_CONFIG[partner.status]
  const busy = approveMutation.isPending || rejectMutation.isPending

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        {/* ── En-tête : nom + badge ────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
              <User className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">
                {partner.first_name} {partner.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {date.toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
        </div>

        {/* ── Contact ─────────────────────────────────────────────────── */}
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{partner.email}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="size-3.5 shrink-0" />
            <span>{partner.phone}</span>
          </div>
        </div>

        {/* ── SIRET + camion ───────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-4 rounded-lg bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">SIRET </span>
            {partner.siret}
          </span>
          <span className="flex items-center gap-1">
            <Truck className="size-3.5" />
            {partner.truck_type}
          </span>
        </div>

        {/* ── Actions (seulement si en attente) ───────────────────────── */}
        {partner.status === "pending" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={busy}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 size-3.5" />
              )}
              Approuver
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              disabled={busy}
              onClick={() => rejectMutation.mutate()}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <XCircle className="mr-1.5 size-3.5" />
              )}
              Rejeter
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Liste candidatures ────────────────────────────────────────────────────────

function PartnerList({ status }: { status?: PartnerStatus }) {
  const queryKey = ["admin-partners", status ?? "all"]

  const { data: partners = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getAdminPartners(status),
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (partners.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <User className="mx-auto mb-3 size-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucune candidature.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {partners.map((p) => (
        <PartnerCard key={p.id} partner={p} queryKey={queryKey} />
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPartnersPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Candidatures chauffeurs</h1>
        <p className="mt-1 text-muted-foreground">
          Gérez les demandes de partenariat des chauffeurs indépendants
        </p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="approved">Approuvées</TabsTrigger>
          <TabsTrigger value="rejected">Rejetées</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <PartnerList />
        </TabsContent>
        <TabsContent value="pending" className="mt-6">
          <PartnerList status="pending" />
        </TabsContent>
        <TabsContent value="approved" className="mt-6">
          <PartnerList status="approved" />
        </TabsContent>
        <TabsContent value="rejected" className="mt-6">
          <PartnerList status="rejected" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
