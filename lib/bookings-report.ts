// Relevé des courses d'une entreprise (contrat du sujet 17) : logique pure partagée par la page admin
// d'une entreprise (vue « admin ») et l'espace entreprise (vue « company »). Aucune dépendance React.
import { ApiError } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"
import type {
  BookingsReport,
  ReportBooking,
  ReportStatusFilter,
  ReportTotals,
  ReportView,
} from "@/lib/types"

export const PARIS_TIMEZONE = "Europe/Paris"

// ── Périodes (dates civiles AAAA-MM-JJ, jamais de calcul en millisecondes) ─────

export interface ReportFilters {
  from: string
  to: string
  status: ReportStatusFilter
}

export const STATUS_FILTERS: { value: ReportStatusFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "done", label: "Réalisées" },
  { value: "cancelled", label: "Annulées" },
  { value: "upcoming", label: "À venir" },
]

const pad = (n: number) => String(n).padStart(2, "0")

// Date civile du jour à Paris (et non celle du fuseau du navigateur ou du serveur).
export function parisToday(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get("year"), month: get("month"), day: get("day") }
}

// Nombre de jours d'un mois civil (month : 1 à 12). Date.UTC sert de calendrier, sans fuseau :
// le jour 0 du mois suivant est le dernier jour du mois demandé.
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// Mois civil → { from: 1er du mois, to: dernier jour }, bornes incluses (interprétées à Paris par l'API).
export function monthRange(year: number, month: number): { from: string; to: string } {
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  }
}

export interface MonthOption {
  value: string // AAAA-MM
  label: string // « novembre 2026 »
  from: string
  to: string
}

const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })

// Mois courant (à Paris) puis les précédents, du plus récent au plus ancien.
export function recentMonths(now: Date = new Date(), count = 12): MonthOption[] {
  let { year, month } = parisToday(now)
  const out: MonthOption[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      value: `${year}-${pad(month)}`,
      label: MONTH_LABEL.format(new Date(Date.UTC(year, month - 1, 1))),
      ...monthRange(year, month),
    })
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return out
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isCivilDate(s: string): boolean {
  const m = DATE_RE.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo)
}

// Contrôle avant envoi des dates saisies ; la limite de 366 jours reste vérifiée par l'API (422).
export function validatePeriod(from: string, to: string): string | null {
  if (!isCivilDate(from) || !isCivilDate(to)) return "Indiquez une date de début et une date de fin."
  // Format AAAA-MM-JJ : l'ordre alphabétique est l'ordre chronologique
  if (from > to) return "La date de fin doit être postérieure ou égale à la date de début."
  return null
}

// « 2026-11-01 » → « 01/11/2026 » (date civile, sans conversion de fuseau)
export function formatCivilDate(s: string): string {
  const m = DATE_RE.exec(s)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s
}

// ── Requêtes ──────────────────────────────────────────────────────────────────

export type ReportFormat = "json" | "xlsx" | "pdf"

// Cible du relevé : l'admin choisit l'entreprise ; un compte entreprise ne désigne jamais la sienne
// (l'API la déduit du compte connecté) : aucun identifiant d'entreprise dans la requête.
export type ReportTarget = { view: "admin"; companyId: string } | { view: "company" }

export function reportQuery(filters: ReportFilters): string {
  return new URLSearchParams({ from: filters.from, to: filters.to, status: filters.status }).toString()
}

export function reportPath(target: ReportTarget, format: ReportFormat, filters: ReportFilters): string {
  const suffix = format === "json" ? "" : `.${format}`
  const base =
    target.view === "admin"
      ? `/admin/companies/${encodeURIComponent(target.companyId)}/bookings-report`
      : "/b2b/bookings-report"
  return `${base}${suffix}?${reportQuery(filters)}`
}

// ── Fichiers exportés ─────────────────────────────────────────────────────────

// Nom du fichier lu dans Content-Disposition (filename* RFC 5987 prioritaire, puis filename).
// Réduit au nom seul (aucun chemin, aucun caractère de contrôle). null si absent ou inutilisable.
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  let name: string | null = null
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header)
  if (star) {
    try {
      name = decodeURIComponent(star[2].trim().replace(/^"|"$/g, ""))
    } catch {
      name = null
    }
  }
  if (name === null) {
    const plain = /filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;\s]+))/i.exec(header)
    if (plain) name = plain[1] !== undefined ? plain[1].replace(/\\(.)/g, "$1") : plain[2]
  }
  if (name === null) return null
  const base = name.split(/[/\\]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim() ?? ""
  if (base === "" || base === "." || base === "..") return null
  return base
}

export function reportFilename(header: string | null, filters: ReportFilters, format: "xlsx" | "pdf"): string {
  return filenameFromDisposition(header) ?? `releve-${filters.from}_${filters.to}.${format}`
}

// ── Affichage ─────────────────────────────────────────────────────────────────

export const NOT_RECORDED = "non enregistré"

const PARIS_DATETIME = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

// Instant RFC 3339 → « 24/11/2026 14:30 », heure de Paris quel que soit le fuseau du navigateur.
export function formatParis(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return PARIS_DATETIME.format(d).replace(",", "")
}

export function completedLabel(b: Pick<ReportBooking, "completed_at" | "completed_at_recorded">): string {
  if (!b.completed_at_recorded) return NOT_RECORDED
  return b.completed_at ? formatParis(b.completed_at) : "—"
}

// Durée en minutes → « 3 h 20 », « 45 min », « 1 j 15 h 30 » : même format que les exports de l'API
// (reportDuration, internal/domain/booking_report_text.go).
function formatDuration(total: number): string {
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const minutes = total % 60
  if (days > 0) return `${days} j ${hours} h ${pad(minutes)}`
  if (hours > 0) return `${hours} h ${pad(minutes)}`
  return `${minutes} min`
}

// Délai entre l'annulation et l'heure prévue de la course.
export function cancelNoticeLabel(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return null
  const m = Math.round(minutes)
  if (m === 0) return "à l'heure prévue de la course"
  if (m < 0) return `${formatDuration(-m)} après l'heure prévue de la course`
  return `${formatDuration(m)} avant la course`
}

export const REPORT_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "En attente de paiement",
  payment_processing: "Débit en cours",
  payment_failed: "Paiement échoué",
  pending_review: "En attente",
  confirmed: "Confirmée",
  assigned: "Chauffeur affecté", // libellé des exports de l'API
  done: "Réalisée",
  cancelled: "Annulée",
}

export function statusLabel(status: string): string {
  return REPORT_STATUS_LABEL[status] ?? status
}

export const HISTORY_TYPE_LABEL: Record<string, string> = {
  address: "Adresse modifiée",
  schedule: "Date modifiée",
  driver_assigned: "Chauffeur affecté",
  driver_changed: "Chauffeur changé",
  driver_unassigned: "Chauffeur retiré",
}

export function historyTypeLabel(type: string): string {
  return HISTORY_TYPE_LABEL[type] ?? "Modification"
}

// Vue company : prénom seul, même si l'API renvoyait un nom de famille.
export function driverName(view: ReportView, driver: ReportBooking["driver"]): string {
  if (!driver) return "—"
  if (view === "company") return driver.first_name
  return [driver.first_name, driver.last_name].filter(Boolean).join(" ")
}

export function creatorName(createdBy: ReportBooking["created_by"]): string {
  if (!createdBy) return "—"
  return [createdBy.first_name, createdBy.last_name].filter(Boolean).join(" ") || createdBy.email
}

// Chemin de l'API admin des photos (`admin_url` = « /admin/bookings/{id}/photos », réponse : URLs signées) :
// vue admin seulement, et seulement s'il a exactement cette forme (appelé via le proxy, jamais un lien).
const ADMIN_PHOTOS_PATH = /^\/admin\/bookings\/[0-9A-Za-z-]+\/photos$/

export function photosApiPath(view: ReportView, photos: ReportBooking["photos"]): string | null {
  if (view !== "admin") return null
  const path = photos.admin_url
  return path && ADMIN_PHOTOS_PATH.test(path) ? path : null
}

const NUMBER = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })
const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

export const formatKm = (n: number) => `${NUMBER.format(n)} km`
export const formatM3 = (n: number) => `${NUMBER.format(n)} m³`
export const formatEuro = (n: number) => EURO.format(n)

export const REFERENCE_PRICE_NOTE = "Prix de référence indicatif, interne"
// Contrat final : distance, volume et prix de référence totalisés hors courses annulées
export function totalsNote(view: ReportView): string {
  return view === "admin"
    ? "Distance, volume et prix de référence : hors courses annulées."
    : "Distance et volume : hors courses annulées."
}

// Colonnes du tableau. Le rendu company ne reçoit jamais les colonnes réservées à l'admin.
export type ReportColumnKey =
  | "reference"
  | "scheduled"
  | "addresses"
  | "status"
  | "completed"
  | "cancellation"
  | "created"
  | "driver"
  | "load"
  | "reference_price"

export interface ReportColumn {
  key: ReportColumnKey
  label: string
}

const COMMON_COLUMNS: ReportColumn[] = [
  { key: "reference", label: "Course" },
  { key: "scheduled", label: "Date prévue" },
  { key: "addresses", label: "Trajet" },
  { key: "status", label: "Statut" },
  { key: "completed", label: "Réalisée le" },
  { key: "cancellation", label: "Annulation" },
  { key: "created", label: "Commandée par" },
  { key: "driver", label: "Chauffeur" },
  { key: "load", label: "Chargement" },
]

const ADMIN_ONLY_COLUMNS: ReportColumn[] = [
  { key: "reference_price", label: "Prix de référence (indicatif, interne)" },
]

export function reportColumns(view: ReportView): ReportColumn[] {
  return view === "admin" ? [...COMMON_COLUMNS, ...ADMIN_ONLY_COLUMNS] : COMMON_COLUMNS
}

export interface TotalsLine {
  label: string
  value: string
  adminOnly?: true
}

export function reportTotalsLines(view: ReportView, totals: ReportTotals): TotalsLine[] {
  const s = totals.by_status
  const lines: TotalsLine[] = [
    { label: "Courses", value: String(totals.count) },
    { label: "Réalisées", value: String(s.done) },
    { label: "Annulées", value: String(s.cancelled) },
    { label: "À venir", value: String(s.upcoming) },
    { label: "Autres", value: String(s.other) },
    { label: "Distance totale", value: formatKm(totals.distance_km) },
    { label: "Volume total", value: formatM3(totals.volume_m3) },
  ]
  if (view === "admin") {
    if (typeof totals.reference_price_ht === "number")
      lines.push({ label: "Prix de référence HT (indicatif, interne)", value: formatEuro(totals.reference_price_ht), adminOnly: true })
    if (typeof totals.reference_price_ttc === "number")
      lines.push({ label: "Prix de référence TTC (indicatif, interne)", value: formatEuro(totals.reference_price_ttc), adminOnly: true })
  }
  return lines
}

// Garde-fou de la vue company : même si l'API renvoyait par erreur une donnée réservée à l'admin,
// elle est retirée avant le rendu (prix de référence, lien photos admin, nom de famille du chauffeur).
export function sanitizeReport(report: BookingsReport, view: ReportView): BookingsReport {
  if (view === "admin") return report
  const bookings = report.bookings.map((b): ReportBooking => {
    const copy: ReportBooking = {
      ...b,
      driver: b.driver ? { first_name: b.driver.first_name, last_name: null } : null,
      photos: { before: b.photos.before, after: b.photos.after, admin_url: null },
    }
    delete copy.reference_price
    return copy
  })
  const totals: ReportTotals = { ...report.totals, by_status: { ...report.totals.by_status } }
  delete totals.reference_price_ht
  delete totals.reference_price_ttc
  return { ...report, view: "company", bookings, totals }
}

// ── Erreurs ───────────────────────────────────────────────────────────────────

// React Query : pas de nouvel essai sur une erreur 4xx (période refusée, route absente, accès refusé)
export function retryUnlessClientError(count: number, err: unknown): boolean {
  return !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 3
}

// 404/405 : entreprise inconnue (admin) ou route pas encore déployée côté API. 403, 422 (période
// trop longue, dates invalides), 429, 503 : errorMessage.
// 400 « id d'entreprise invalide » (identifiant de l'URL admin non UUID) : même message que 404.
const isNotFound = (err: unknown, view: ReportView) =>
  err instanceof ApiError && (err.status === 404 || err.status === 405 || (view === "admin" && err.status === 400))

export function reportErrorMessage(err: unknown, view: ReportView): string {
  if (isNotFound(err, view)) {
    return view === "admin"
      ? "Relevé indisponible : entreprise introuvable ou service pas encore à jour."
      : "Le relevé des courses n'est pas encore disponible, réessayez plus tard."
  }
  return errorMessage(err, "Impossible de charger le relevé des courses.")
}

export function exportErrorMessage(err: unknown, view: ReportView): string {
  if (isNotFound(err, view)) return reportErrorMessage(err, view)
  return errorMessage(err, "L'export n'a pas pu être téléchargé.")
}

export function companyErrorMessage(err: unknown): string {
  if (isNotFound(err, "admin"))
    return "Entreprise introuvable ou informations indisponibles."
  return errorMessage(err, "Impossible de charger l'entreprise.")
}

export function photosErrorMessage(err: unknown): string {
  return errorMessage(err, "Les photos n'ont pas pu être chargées.")
}
