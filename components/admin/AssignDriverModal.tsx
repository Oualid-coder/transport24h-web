"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, UserPlus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { assignDriver, getAdminDrivers, ApiError } from "@/lib/api"
import type { Driver, PaginatedBookings } from "@/lib/types"
import { CreateDriverModal } from "./CreateDriverModal"

export function AssignDriverModal({
  open,
  bookingId,
  queryKey,
  onClose,
}: {
  open: boolean
  bookingId: string
  queryKey: unknown[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: getAdminDrivers,
    staleTime: 30_000,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (driverId: string) => assignDriver(bookingId, driverId),
    onSuccess: (updated) => {
      queryClient.setQueryData<PaginatedBookings>(queryKey, (old) =>
        old ? { ...old, bookings: old.bookings.map((b) => (b.id === updated.id ? updated : b)) } : old,
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
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && mutation.isPending) return
        if (!isOpen) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-0 overflow-hidden p-0 bg-background"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="font-semibold">Assigner un chauffeur</DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreate(true)}
            >
              <UserPlus className="mr-1.5 size-3.5" />
              Ajouter CDI
            </Button>
            <DialogClose
              render={
                <button
                  disabled={mutation.isPending}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  aria-label="Fermer"
                />
              }
            >
              <X className="size-4" />
            </DialogClose>
          </div>
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
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {driver.first_name} {driver.last_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {driver.email}
                      {driver.phone ? ` · ${driver.phone}` : ""}
                    </p>
                  </div>
                  <Badge
                    className={
                      driver.employment_type === "employee"
                        ? "shrink-0 border-sky-500/30 bg-sky-500/15 text-sky-500"
                        : "shrink-0 border-violet-500/30 bg-violet-500/15 text-violet-500"
                    }
                  >
                    {driver.employment_type === "employee" ? "Employé CDI" : "Partenaire"}
                  </Badge>
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
              msg.type === "success" ? "text-primary" : "text-destructive"
            }`}
          >
            {msg.text}
          </div>
        )}
      </DialogContent>

      {showCreate && (
        <CreateDriverModal
          open
          onClose={() => setShowCreate(false)}
          onCreated={() =>
            queryClient.invalidateQueries({ queryKey: ["admin-drivers"] })
          }
        />
      )}
    </Dialog>
  )
}
