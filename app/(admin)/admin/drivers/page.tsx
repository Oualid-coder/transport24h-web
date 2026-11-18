"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Mail, Pencil, Phone, UserPlus, Users, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { deactivateDriver, getAdminDrivers } from "@/lib/api"
import type { Driver, DriverEmploymentType } from "@/lib/types"
import { BackButton } from "@/components/BackButton"
import { CreateDriverModal } from "@/components/admin/CreateDriverModal"
import { EditDriverModal } from "@/components/admin/EditDriverModal"

const EMPLOYMENT_CONFIG: Record<
  DriverEmploymentType,
  { label: string; className: string }
> = {
  employee: {
    label: "Employé CDI",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  partner: {
    label: "Partenaire",
    className: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  },
}

function DriverRow({
  driver,
  confirming,
  deactivating,
  onEdit,
  onDeactivateRequest,
  onDeactivateConfirm,
  onDeactivateCancel,
}: {
  driver: Driver
  confirming: boolean
  deactivating: boolean
  onEdit: () => void
  onDeactivateRequest: () => void
  onDeactivateConfirm: () => void
  onDeactivateCancel: () => void
}) {
  const badge = EMPLOYMENT_CONFIG[driver.employment_type]
  return (
    <tr className="border-b border-border/50 transition-colors hover:bg-accent/30">
      <td className="py-3 pr-4">
        <p className="text-sm font-medium">
          {driver.first_name} {driver.last_name}
        </p>
      </td>
      <td className="py-3 pr-4">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Mail className="size-3.5 shrink-0" />
          {driver.email}
        </span>
      </td>
      <td className="py-3 pr-4">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Phone className="size-3.5 shrink-0" />
          {driver.phone}
        </span>
      </td>
      <td className="py-3 pr-4">
        <Badge className={badge.className}>{badge.label}</Badge>
      </td>
      <td className="py-3">
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Désactiver ?</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-xs"
              disabled={deactivating}
              onClick={onDeactivateConfirm}
            >
              {deactivating ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                "Confirmer"
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={deactivating}
              onClick={onDeactivateCancel}
            >
              Annuler
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
              title="Modifier"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={onDeactivateRequest}
              title="Désactiver"
            >
              <UserX className="size-3.5" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  )
}

export default function DriversPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editDriver, setEditDriver] = useState<Driver | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: getAdminDrivers,
    staleTime: 30_000,
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateDriver(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] })
      setConfirmingId(null)
    },
    onError: () => setConfirmingId(null),
  })

  return (
    <div className="space-y-6">
      <BackButton href="/admin/dashboard" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chauffeurs</h1>
          <p className="mt-1 text-muted-foreground">
            {isLoading
              ? "Chargement…"
              : `${drivers.length} chauffeur${drivers.length > 1 ? "s" : ""} actif${drivers.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-2 size-4" />
          Ajouter CDI
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : drivers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Users className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">Aucun chauffeur enregistré.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent/40">
                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Nom
                </th>
                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </th>
                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Téléphone
                </th>
                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Type
                </th>
                <th className="py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <DriverRow
                  key={d.id}
                  driver={d}
                  confirming={confirmingId === d.id}
                  deactivating={deactivateMutation.isPending && confirmingId === d.id}
                  onEdit={() => setEditDriver(d)}
                  onDeactivateRequest={() => setConfirmingId(d.id)}
                  onDeactivateConfirm={() => deactivateMutation.mutate(d.id)}
                  onDeactivateCancel={() => setConfirmingId(null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateDriverModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-drivers"] })
          setCreateOpen(false)
        }}
      />

      <EditDriverModal
        key={editDriver?.id}
        open={editDriver !== null}
        driver={editDriver}
        onClose={() => setEditDriver(null)}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-drivers"] })
          setEditDriver(null)
        }}
      />
    </div>
  )
}
