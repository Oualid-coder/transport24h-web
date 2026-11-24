"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Loader2 } from "lucide-react"
import { getAdminCompany } from "@/lib/api"
import { companyErrorMessage, formatParis, retryUnlessClientError } from "@/lib/bookings-report"

export function CompanyInfo({ id }: { id: string }) {
  const { data: company, isLoading, error } = useQuery({
    queryKey: ["admin-company", id],
    queryFn: () => getAdminCompany(id),
    staleTime: 30_000,
    retry: retryUnlessClientError,
  })

  if (isLoading) {
    return (
      <div className="flex py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Entreprise</h1>
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {companyErrorMessage(error)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="break-words text-3xl font-bold">{company.name}</h1>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">SIRET</dt>
          <dd>{company.siret || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Téléphone</dt>
          <dd>{company.contact_phone || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Créée le</dt>
          <dd>{formatParis(company.created_at)}</dd>
        </div>
      </dl>
    </div>
  )
}
