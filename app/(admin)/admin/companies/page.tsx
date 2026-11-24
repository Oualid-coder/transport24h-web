"use client"

import { useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Building2, Loader2, Mail, MailCheck, Plus, RefreshCw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getAdminCompanies, resendCompanyInvitation } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"
import { canResendInvitation, invitationResentMessage, resendErrorMessage } from "@/lib/invitation-resend"
import type { Company, InvitationStatus } from "@/lib/types"
import { BackButton } from "@/components/BackButton"
import { CreateCompanyModal } from "@/components/admin/CreateCompanyModal"
import { InviteCompanyModal } from "@/components/admin/InviteCompanyModal"
import { invitationSentMessage } from "@/lib/company-invitation"

// ── Statut d'invitation ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvitationStatus, { label: string; className: string }> = {
  not_invited: {
    label: "Non invité",
    className: "border-border bg-transparent text-muted-foreground",
  },
  invited: {
    label: "Invitation envoyée",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  expired: {
    label: "Expirée",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  active: {
    label: "Activé",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
}

// ── Toast simple ──────────────────────────────────────────────────────────────

interface Toast {
  id: number
  type: "success" | "error"
  message: string
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    )
  }, [])

  return { toasts, push }
}

// ── Ligne du tableau ──────────────────────────────────────────────────────────

function CompanyRow({
  company,
  onInvite,
  resending,
  resendDisabled,
  onResend,
}: {
  company: Company
  onInvite: (company: Company) => void
  resending: boolean
  resendDisabled: boolean
  onResend: (company: Company) => void
}) {
  const cfg = STATUS_CONFIG[company.invitation_status]
  const canInvite = company.invitation_status === "not_invited"
  // Compte non activé (invitation en cours ou expirée) : nouveau lien, l'ancien ne fonctionne plus.
  const canResend = canResendInvitation(company.invitation_status)

  return (
    <tr className="border-b border-border/50 transition-colors hover:bg-accent/30">
      <td className="py-3 pr-4">
        <Link
          href={`/admin/companies/${encodeURIComponent(company.id)}`}
          className="text-sm font-medium underline-offset-4 hover:text-primary hover:underline"
        >
          {company.name}
        </Link>
      </td>
      <td className="py-3 pr-4">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Mail className="size-3.5 shrink-0" />
          {company.contact_email}
        </span>
      </td>
      <td className="py-3 pr-4">
        <Badge className={cfg.className}>{cfg.label}</Badge>
      </td>
      <td className="py-3 pr-4 text-sm text-muted-foreground">
        {new Date(company.created_at).toLocaleDateString("fr-FR")}
      </td>
      <td className="py-3">
        {company.invitation_status === "active" ? (
          <span className="flex items-center gap-1.5 text-xs text-primary">
            <MailCheck className="size-3.5" />
            Compte actif
          </span>
        ) : canInvite ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => onInvite(company)}
          >
            <Send className="size-3" />
            Inviter
          </Button>
        ) : canResend ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            disabled={resendDisabled}
            aria-busy={resending}
            onClick={() => onResend(company)}
          >
            {resending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            {resending ? "Envoi…" : "Renvoyer l'invitation"}
          </Button>
        ) : null}
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  // Entreprise dont on saisit le contact à inviter (bouton « Inviter » ou juste après la création)
  const [inviteTarget, setInviteTarget] = useState<{ id: string; name: string } | null>(null)
  const { toasts, push: pushToast } = useToast()

  const { data: companies = [], isLoading, error } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: getAdminCompanies,
    staleTime: 30_000,
  })

  const handleInvite = (company: Company) => setInviteTarget({ id: company.id, name: company.name })

  // Un seul renvoi à la fois : bouton désactivé pendant l'appel, second clic ignoré.
  const [resendingId, setResendingId] = useState<string | null>(null)
  const resendInFlight = useRef(false)
  const resendMutation = useMutation({
    mutationFn: (company: Company) => resendCompanyInvitation(company.id),
    onSuccess: (_data, company) => {
      pushToast("success", invitationResentMessage(company.contact_email))
    },
    onError: (err) => {
      pushToast("error", resendErrorMessage(err, "L'invitation n'a pas pu être renvoyée."))
    },
    onSettled: () => {
      resendInFlight.current = false
      setResendingId(null)
      // Statut (expirée → envoyée, ou activée entre-temps) relu dans tous les cas
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] })
    },
  })

  const handleResend = (company: Company) => {
    if (resendInFlight.current) return
    resendInFlight.current = true
    setResendingId(company.id)
    resendMutation.mutate(company)
  }

  return (
    <div className="space-y-6">
      <BackButton href="/admin/dashboard" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Entreprises</h1>
          <p className="mt-1 text-muted-foreground">
            {isLoading
              ? "Chargement…"
              : error && companies.length === 0
                ? "Liste indisponible"
                : `${companies.length} entreprise${companies.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          Créer une entreprise
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error && companies.length === 0 ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {errorMessage(error, "Impossible de charger les entreprises.")}
        </div>
      ) : companies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Building2 className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">Aucune entreprise enregistrée.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-accent/40">
                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Entreprise
                </th>
                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email contact
                </th>
                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Statut invitation
                </th>
                <th className="py-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Date
                </th>
                <th className="py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <CompanyRow
                  key={c.id}
                  company={c}
                  onInvite={handleInvite}
                  resending={resendingId === c.id}
                  resendDisabled={resendingId !== null}
                  onResend={handleResend}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateCompanyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(company) => {
          queryClient.invalidateQueries({ queryKey: ["admin-companies"] })
          setCreateOpen(false)
          // Dans la foulée : saisie du contact à inviter (« Plus tard » laisse l'entreprise « Non invité »)
          setInviteTarget({ id: company.id, name: company.name })
        }}
      />

      <InviteCompanyModal
        company={inviteTarget}
        onClose={() => {
          setInviteTarget(null)
          // Le statut a pu changer côté serveur même après une erreur
          queryClient.invalidateQueries({ queryKey: ["admin-companies"] })
        }}
        onInvited={(email) => {
          setInviteTarget(null)
          pushToast("success", invitationSentMessage(email))
          queryClient.invalidateQueries({ queryKey: ["admin-companies"] })
        }}
      />

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
              t.type === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-primary/30 bg-primary/10 text-primary"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
