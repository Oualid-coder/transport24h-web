"use client"

import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Loader2, Mail, Pencil, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { deactivateDriver, getDriverInvitations, resendDriverInvitation } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"
import {
  canResendInvitation,
  driverInvitationStatusLabel,
  invitationResentMessage,
  resendErrorMessage,
} from "@/lib/invitation-resend"
import type { DriverInvitation } from "@/lib/types"
import { EditDriverModal } from "@/components/admin/EditDriverModal"

export const DRIVER_INVITATIONS_QUERY_KEY = ["admin-driver-invitations"] as const

function InvitationRow({
  invitation,
  onEdit,
}: {
  invitation: DriverInvitation
  onEdit: () => void
}) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: DRIVER_INVITATIONS_QUERY_KEY })
  // Garde synchrone : un double clic ne déclenche qu'un appel (comme les autres renvois).
  const inFlight = useRef(false)
  const [lastError, setLastError] = useState<unknown>(null)
  const mutation = useMutation({
    mutationFn: () => resendDriverInvitation(invitation.id),
    onMutate: () => setLastError(null),
    onError: (err) => setLastError(err),
    // Renvoi réussi : nouveau lien valable 72 h, le statut (« Lien expiré ») est relu.
    onSuccess: refresh,
    onSettled: () => {
      inFlight.current = false
    },
  })
  // Annulation (DELETE /admin/drivers/{id} : compte désactivé, jeton effacé, lien mort),
  // après confirmation.
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const cancelMutation = useMutation({
    mutationFn: () => deactivateDriver(invitation.id),
    onSuccess: () => {
      setConfirmingCancel(false)
      refresh()
    },
  })
  const handleResend = () => {
    if (inFlight.current) return
    inFlight.current = true
    mutation.mutate()
  }
  const expired = invitation.invitation_status === "expired"

  return (
    <li className="flex flex-col gap-2 border-b border-border/50 py-3 last:border-b-0 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">
          {invitation.first_name} {invitation.last_name}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Mail className="size-3.5 shrink-0" />
          <span className="break-all">{invitation.email}</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge className="border-border bg-accent/50 text-muted-foreground">
            {invitation.employment_type === "partner" ? "Partenaire" : "Employé CDI"}
          </Badge>
          <Badge
            className={
              expired
                ? "border-amber-500/30 bg-amber-500/15 text-amber-600"
                : "border-primary/30 bg-primary/10 text-primary"
            }
          >
            {driverInvitationStatusLabel(invitation.invitation_status)}
          </Badge>
        </div>
      </div>
      <div className="space-y-1 lg:w-56 lg:shrink-0">
      {canResendInvitation(invitation.invitation_status) && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={mutation.isPending}
            aria-busy={mutation.isPending}
            onClick={handleResend}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 size-3.5" />
            )}
            {mutation.isPending ? "Envoi…" : "Renvoyer l'invitation"}
          </Button>
          {mutation.isSuccess && (
            <p role="status" className="px-1 text-[11px] text-emerald-600">
              {invitationResentMessage(invitation.email)}
            </p>
          )}
          {lastError !== null && (
            <p role="alert" className="px-1 text-[11px] text-destructive">
              {resendErrorMessage(lastError, "L'invitation n'a pas pu être renvoyée. Réessayez.")}
            </p>
          )}
        </>
      )}
        {confirmingCancel ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Annuler l&apos;invitation ?</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-xs"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              {cancelMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : "Confirmer"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={cancelMutation.isPending}
              onClick={() => setConfirmingCancel(false)}
            >
              Non
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={onEdit}>
              <Pencil className="mr-1.5 size-3.5" />
              Corriger
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-xs text-destructive hover:text-destructive"
              onClick={() => {
                cancelMutation.reset()
                setConfirmingCancel(true)
              }}
            >
              <X className="mr-1.5 size-3.5" />
              Annuler l&apos;invitation
            </Button>
          </div>
        )}
        {cancelMutation.isError && (
          <p role="alert" className="px-1 text-[11px] text-destructive">
            {errorMessage(cancelMutation.error, "L'invitation n'a pas pu être annulée. Réessayez.")}
          </p>
        )}
      </div>
    </li>
  )
}

// Chauffeurs créés par l'admin (CDI) ou approuvés (partenaires) qui n'ont pas encore activé
// leur compte : ils n'apparaissent pas dans la liste des chauffeurs actifs ni à l'affectation.
export function DriverInvitations() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<DriverInvitation | null>(null)
  const { data: invitations = [], isLoading, error } = useQuery({
    queryKey: DRIVER_INVITATIONS_QUERY_KEY,
    queryFn: getDriverInvitations,
    staleTime: 30_000,
  })

  if (isLoading) return null

  return (
    <section aria-labelledby="driver-invitations-title" className="space-y-3">
      <div>
        <h2 id="driver-invitations-title" className="text-lg font-semibold">
          Invitations en attente
        </h2>
        <p className="text-sm text-muted-foreground">
          Le chauffeur active son compte et choisit son mot de passe avec le lien reçu par e-mail
          (valable 72 heures, un seul usage). Corriger l&apos;adresse e-mail rend le lien envoyé
          inutilisable : renvoyez ensuite l&apos;invitation.
        </p>
      </div>
      {error && invitations.length === 0 ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {errorMessage(error, "Impossible de charger les invitations.")}
        </div>
      ) : invitations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Aucune invitation en attente.
        </p>
      ) : (
        <ul className="rounded-lg border border-border px-4">
          {invitations.map((inv) => (
            <InvitationRow key={inv.id} invitation={inv} onEdit={() => setEditing(inv)} />
          ))}
        </ul>
      )}
      {/* Correction (ex. email erroné) : un nouvel email expire le lien déjà envoyé ;
          l'invitation passe en « Lien expiré », à renvoyer à la nouvelle adresse. */}
      <EditDriverModal
        key={editing?.id}
        open={editing !== null}
        driver={editing}
        onClose={() => setEditing(null)}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: DRIVER_INVITATIONS_QUERY_KEY })
          setEditing(null)
        }}
      />
    </section>
  )
}
