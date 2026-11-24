"use client"

// Relevé des courses d'une entreprise, partagé par la page admin d'une entreprise (vue « admin ») et
// l'espace entreprise (vue « company »). Les colonnes et totaux viennent de reportColumns /
// reportTotalsLines : le rendu company ne contient aucune colonne réservée à l'admin.
import { Fragment, useMemo, useState } from "react"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, Camera, ChevronDown, ChevronRight, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { downloadBookingsReport, getBookingsReport, getReportPhotos } from "@/lib/api"
import { saveBlob } from "@/lib/download"
import {
  NOT_RECORDED,
  REFERENCE_PRICE_NOTE,
  STATUS_FILTERS,
  cancelNoticeLabel,
  completedLabel,
  creatorName,
  driverName,
  exportErrorMessage,
  formatCivilDate,
  formatEuro,
  formatKm,
  formatM3,
  formatParis,
  historyTypeLabel,
  photosApiPath,
  photosErrorMessage,
  totalsNote,
  recentMonths,
  reportColumns,
  reportErrorMessage,
  reportTotalsLines,
  retryUnlessClientError,
  sanitizeReport,
  statusLabel,
  validatePeriod,
  type ReportColumnKey,
  type ReportFilters,
  type ReportTarget,
} from "@/lib/bookings-report"
import type { ReportBooking, ReportStatusFilter, ReportView } from "@/lib/types"

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 max-lg:h-11"

function Cell({ column, booking, view }: { column: ReportColumnKey; booking: ReportBooking; view: ReportView }) {
  const b = booking
  switch (column) {
    case "reference":
      return <span className="whitespace-nowrap font-medium">{b.reference}</span>
    case "scheduled":
      return <span className="whitespace-nowrap">{formatParis(b.scheduled_at)}</span>
    case "addresses":
      return (
        <div className="min-w-48 space-y-0.5">
          <p><span className="text-muted-foreground">De : </span>{b.pickup_address}</p>
          <p><span className="text-muted-foreground">À : </span>{b.delivery_address}</p>
        </div>
      )
    case "status":
      return <span className="whitespace-nowrap">{statusLabel(b.status)}</span>
    case "completed": {
      const label = completedLabel(b)
      return (
        <span className={label === NOT_RECORDED ? "italic text-muted-foreground" : "whitespace-nowrap"}>
          {label}
        </span>
      )
    }
    case "cancellation": {
      if (!b.cancelled_at) return <span className="text-muted-foreground">—</span>
      const notice = cancelNoticeLabel(b.cancel_notice_minutes)
      return (
        <div>
          <p className="whitespace-nowrap">{formatParis(b.cancelled_at)}</p>
          {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
        </div>
      )
    }
    case "created":
      return (
        <div>
          <p>{creatorName(b.created_by)}</p>
          <p className="whitespace-nowrap text-xs text-muted-foreground">le {formatParis(b.created_at)}</p>
        </div>
      )
    case "driver":
      return <span>{driverName(view, b.driver)}</span>
    case "load":
      return (
        <div className="whitespace-nowrap">
          <p>{formatKm(b.distance_km)} · {formatM3(b.volume_m3)}</p>
          <p className="text-xs text-muted-foreground">
            {b.truck_type ? `Camion ${b.truck_type}` : "Camion —"} · {b.helpers_count} manutentionnaire
            {b.helpers_count > 1 ? "s" : ""}
          </p>
        </div>
      )
    case "reference_price":
      return b.reference_price ? (
        <div className="whitespace-nowrap">
          <p>{formatEuro(b.reference_price.ht)} HT</p>
          <p className="text-xs text-muted-foreground">{formatEuro(b.reference_price.ttc)} TTC · indicatif</p>
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}

function PhotoThumbs({ urls, label }: { urls: string[]; label: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {urls.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">Aucune photo.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
              <Image
                src={url}
                alt={`Photo ${label.toLowerCase()} n°${i + 1} — ouvrir en grand`}
                width={64}
                height={64}
                className="h-16 w-16 rounded-md border border-border/50 object-cover hover:opacity-80"
                unoptimized
              />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// Vue admin : photos chargées à la demande (URLs signées qui expirent : jamais gardées en cache)
function ReportPhotos({ path, reference }: { path: string; reference: string }) {
  const [shown, setShown] = useState(false)
  const { data, isFetching, error } = useQuery({
    queryKey: ["report-photos", path],
    queryFn: () => getReportPhotos(path),
    enabled: shown,
    staleTime: 0,
    gcTime: 0,
    retry: retryUnlessClientError,
  })
  if (!shown) {
    return (
      <Button variant="outline" size="sm" className="mt-1" onClick={() => setShown(true)}>
        <Camera />
        Voir les photos<span className="sr-only"> de {reference}</span>
      </Button>
    )
  }
  if (isFetching && !data) return <Loader2 className="mt-1 size-4 animate-spin text-muted-foreground" aria-label="Chargement des photos" />
  if (error) return <p role="alert" className="mt-1 text-xs text-destructive">{photosErrorMessage(error)}</p>
  if (!data) return null
  return (
    <div className="mt-2 space-y-2">
      <PhotoThumbs urls={data.before} label="Avant" />
      <PhotoThumbs urls={data.after} label="Après" />
    </div>
  )
}

function Detail({ booking, view }: { booking: ReportBooking; view: ReportView }) {
  const b = booking
  const photosPath = photosApiPath(view, b.photos)
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-3">
      <div>
        <p className="mb-1 font-medium">Historique</p>
        {!b.history_recorded ? (
          <p className="italic text-muted-foreground">Historique {NOT_RECORDED}</p>
        ) : b.history.length === 0 ? (
          <p className="text-muted-foreground">Aucune modification.</p>
        ) : (
          <ul className="space-y-1">
            {b.history.map((h, i) => (
              <li key={i}>
                <span className="whitespace-nowrap text-muted-foreground">{formatParis(h.at)}</span>{" "}
                {h.detail || historyTypeLabel(h.type)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="mb-1 font-medium">Photos</p>
        <p>Avant : {b.photos.before ? "oui" : "non"} · Après : {b.photos.after ? "oui" : "non"}</p>
        {photosPath && <ReportPhotos path={photosPath} reference={b.reference} />}
      </div>
      <div className="min-w-0">
        <p className="mb-1 font-medium">Commentaire</p>
        <p className="break-words whitespace-pre-line text-muted-foreground">{b.client_comment || "Aucun commentaire."}</p>
      </div>
    </div>
  )
}

export function BookingsReport({ target, title }: { target: ReportTarget; title: string }) {
  const view = target.view
  const months = useMemo(() => recentMonths(), [])
  const [mode, setMode] = useState<"month" | "custom">("month")
  const [month, setMonth] = useState(months[0].value)
  const [customFrom, setCustomFrom] = useState(months[0].from)
  const [customTo, setCustomTo] = useState(months[0].to)
  const [customError, setCustomError] = useState<string | null>(null)
  const [status, setStatus] = useState<ReportStatusFilter>("all")
  const [period, setPeriod] = useState({ from: months[0].from, to: months[0].to })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const filters: ReportFilters = { from: period.from, to: period.to, status }
  const companyKey = target.view === "admin" ? target.companyId : "me"

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["bookings-report", view, companyKey, filters.from, filters.to, filters.status],
    queryFn: () => getBookingsReport(target, filters),
    retry: retryUnlessClientError,
  })
  const report = data ? sanitizeReport(data, view) : null
  const columns = reportColumns(view)

  const selectMonth = (value: string) => {
    setMonth(value)
    const m = months.find((o) => o.value === value)
    if (m) setPeriod({ from: m.from, to: m.to })
  }

  const applyCustom = () => {
    const err = validatePeriod(customFrom, customTo)
    setCustomError(err)
    if (!err) setPeriod({ from: customFrom, to: customTo })
  }

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleExport = async (format: "xlsx" | "pdf") => {
    if (exporting) return
    setExporting(format)
    setExportError(null)
    try {
      const { blob, filename } = await downloadBookingsReport(target, filters, format)
      saveBlob(blob, filename)
    } catch (err) {
      setExportError(exportErrorMessage(err, view))
    } finally {
      setExporting(null)
    }
  }

  const idPrefix = `report-${view}`

  return (
    // contain inline-size : le tableau large ne fait pas grandir la page (défilement dans son cadre),
    // même dans un parent flex sans min-w-0 (mise en page admin).
    <section className="min-w-0 space-y-4 [contain:inline-size]" aria-labelledby={`${idPrefix}-title`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${idPrefix}-title`} className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Du {formatCivilDate(filters.from)} au {formatCivilDate(filters.to)} · heures de Paris
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={exporting !== null} aria-busy={exporting === "xlsx"} onClick={() => handleExport("xlsx")}>
            {exporting === "xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            Exporter Excel
          </Button>
          <Button variant="outline" size="sm" disabled={exporting !== null} aria-busy={exporting === "pdf"} onClick={() => handleExport("pdf")}>
            {exporting === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />}
            Exporter PDF
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-mode`} className="text-xs text-muted-foreground">Période</label>
          <select
            id={`${idPrefix}-mode`}
            className={SELECT_CLASS}
            value={mode}
            onChange={(e) => {
              const next = e.target.value === "custom" ? "custom" : "month"
              setMode(next)
              setCustomError(null)
              if (next === "month") selectMonth(month)
            }}
          >
            <option value="month">Mois</option>
            <option value="custom">Dates</option>
          </select>
        </div>
        {mode === "month" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idPrefix}-month`} className="text-xs text-muted-foreground">Mois</label>
            <select id={`${idPrefix}-month`} className={SELECT_CLASS} value={month} onChange={(e) => selectMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${idPrefix}-from`} className="text-xs text-muted-foreground">Du</label>
              <Input id={`${idPrefix}-from`} type="date" className="w-auto" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${idPrefix}-to`} className="text-xs text-muted-foreground">Au</label>
              <Input id={`${idPrefix}-to`} type="date" className="w-auto" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
            <Button size="sm" onClick={applyCustom}>Appliquer</Button>
          </>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-status`} className="text-xs text-muted-foreground">Statut</label>
          <select
            id={`${idPrefix}-status`}
            className={SELECT_CLASS}
            value={status}
            onChange={(e) => {
              const v = STATUS_FILTERS.find((s) => s.value === e.target.value)
              if (v) setStatus(v.value)
            }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        {isFetching && !isLoading && <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" aria-label="Mise à jour" />}
      </div>

      {customError && <p role="alert" className="text-sm text-destructive">{customError}</p>}
      {exportError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {exportError}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Relevé indisponible</p>
            <p>{reportErrorMessage(error, view)}</p>
          </div>
        </div>
      ) : report ? (
        <>
          {report.bookings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              Aucune course sur cette période.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm max-lg:min-w-[56rem]">
                <thead>
                  <tr className="border-b border-border bg-accent/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-8 px-2 py-2.5"><span className="sr-only">Détail</span></th>
                    {columns.map((c) => (
                      <th key={c.key} className="px-2 py-2.5 font-medium">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.bookings.map((b) => {
                    const open = expanded.has(b.id)
                    return (
                      <Fragment key={b.id}>
                        <tr className="border-b border-border/50 align-top">
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => toggle(b.id)}
                              aria-expanded={open}
                              aria-controls={`${idPrefix}-detail-${b.id}`}
                              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground max-lg:p-3.5"
                              title={open ? "Masquer le détail" : "Voir le détail"}
                            >
                              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                              <span className="sr-only">{open ? "Masquer le détail" : "Voir le détail"} de {b.reference}</span>
                            </button>
                          </td>
                          {columns.map((c) => (
                            <td key={c.key} className="px-2 py-2.5">
                              <Cell column={c.key} booking={b} view={view} />
                            </td>
                          ))}
                        </tr>
                        {open && (
                          <tr id={`${idPrefix}-detail-${b.id}`} className="border-b border-border/50 bg-accent/20">
                            <td />
                            <td colSpan={columns.length} className="px-2 py-3">
                              <Detail booking={b} view={view} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Totaux */}
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium">Totaux</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              {reportTotalsLines(view, report.totals).map((l) => (
                <div key={l.label} className={l.adminOnly ? "col-span-2" : undefined}>
                  <dt className="text-xs text-muted-foreground">{l.label}</dt>
                  <dd className="font-medium">{l.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">{totalsNote(view)}</p>
            {view === "admin" && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                {REFERENCE_PRICE_NOTE}.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {report.company.name} · généré le {formatParis(report.generated_at)}
          </p>
        </>
      ) : null}
    </section>
  )
}
