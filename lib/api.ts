import type {
  AdminStats,
  Booking,
  BookingPhotos,
  BookingWithClient,
  CancellationResult,
  Company,
  ConfirmSetupResult,
  CreateBookingBody,
  CreditNoteRetry,
  CreditNoteRetryResult,
  CreateQuoteBody,
  Driver,
  DriverCreated,
  EstimateBody,
  EstimateResult,
  GeoPoint,
  HelpersSurcharge,
  PartnerApplyBody,
  AcceptInvitationBody,
  PartnerApplication,
  PaymentIntent,
  PaginatedBookings,
  PriceAdjustment,
  PriceAdjustmentBody,
  PriceAdjustmentPreview,
  PricingConfig,
  RefundResult,
  RegisterBody,
  SavedQuote,
  SetupIntentResponse,
  TruckSurcharge,
  TruckType,
} from "@/lib/types"
import { safeRedirectPath } from "@/lib/safe-redirect"

// Toutes les requêtes authentifiées passent par le proxy Next.js (/api/proxy).
// Le Route Handler lit le cookie httpOnly access_token côté serveur et injecte
// le header Authorization: Bearer — résout le problème cross-origin (3000 → 8080).
const PROXY_BASE = "/api/proxy"

// URL directe du backend — réservée aux routes publiques sans auth (ex: /quotes/estimate)
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // Délai en secondes lu dans l'en-tête Retry-After (429), null s'il est absent
    public readonly retryAfter: number | null = null,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// parseRetryAfter lit Retry-After : nombre de secondes ou date HTTP. null si absent ou illisible.
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null
  const v = value.trim()
  if (/^\d+$/.test(v)) return Number(v)
  const date = Date.parse(v)
  if (Number.isNaN(date)) return null
  return Math.max(0, Math.ceil((date - now) / 1000))
}

// Renouvellement de session (audit M5) : POST /api/auth/refresh repose access_token depuis le cookie
// refresh_token. Une seule tentative en vol : les requêtes qui échouent en parallèle attendent la même.
// unauthorized (401/403) : session finie → connexion. rateLimited (429, limite de la gateway par IP) et
// unavailable (5xx, réseau) : passagers → message, sans redirection (le formulaire en cours est gardé).
export type RefreshResult =
  | { kind: "ok" }
  | { kind: "unauthorized" }
  | { kind: "rateLimited"; retryAfter: number | null }
  | { kind: "unavailable" }

let refreshInFlight: Promise<RefreshResult> | null = null

export function refreshSession(): Promise<RefreshResult> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
      .then((res): RefreshResult => {
        if (res.ok) return { kind: "ok" }
        if (res.status === 401 || res.status === 403) return { kind: "unauthorized" }
        if (res.status === 429) return { kind: "rateLimited", retryAfter: parseRetryAfter(res.headers.get("retry-after")) }
        return { kind: "unavailable" }
      })
      .catch((): RefreshResult => ({ kind: "unavailable" }))
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

// Message affiché quand le renouvellement échoue pour une raison passagère
export function refreshErrorMessage(result: { kind: "rateLimited"; retryAfter: number | null } | { kind: "unavailable" }): string {
  if (result.kind === "unavailable") return "Service momentanément indisponible, réessayez."
  return result.retryAfter !== null && result.retryAfter > 0
    ? `Trop de demandes en ce moment, réessayez dans ${result.retryAfter} s.`
    : "Trop de demandes en ce moment, réessayez dans quelques instants."
}

// Valeur d'un cookie non httpOnly (user_role) dans une chaîne document.cookie
function cookieValue(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(";")) {
    const [k, ...v] = part.trim().split("=")
    if (k === name) return v.join("=")
  }
  return null
}

function homeForRole(role: string | null): string {
  if (role === "admin") return "/admin/dashboard"
  if (role === "driver") return "/driver/dashboard"
  return "/dashboard"
}

const readDocumentCookies = (): string => (typeof document !== "undefined" ? document.cookie : "")

export type ResumeResult =
  | { kind: "navigate"; to: string }
  | { kind: "retry"; message: string; retryAfter: number | null; loginUrl: string }

// Page /session (redirection de proxy.ts sans access_token) : que faire après une tentative de refresh.
// - succès ET cookie user_role visible (posé avec access_token) → page demandée, ou accueil du rôle ;
//   cookie absent (non enregistré) → connexion, jamais de retour vers la page protégée (boucle) ;
// - session refusée → connexion ; 429 / indisponible → message et nouvel essai (pas de redirection).
// recentAttempt : un renouvellement vient déjà de réussir dans cet onglet (garde sessionStorage, en
// complément) → connexion directe.
function clearDocumentRoleCookie(): void {
  if (typeof document === "undefined") return
  document.cookie = "user_role=; path=/; max-age=0"
}

export async function resumeSession(
  rawRedirect: string | null,
  recentAttempt = false,
  readCookies: () => string = readDocumentCookies,
  clearRoleCookie: () => void = clearDocumentRoleCookie,
): Promise<ResumeResult> {
  const asked = safeRedirectPath(rawRedirect)
  const loginUrl = (to: string | null) => (to ? `/login?redirect=${encodeURIComponent(to)}` : "/login")
  if (recentAttempt) return { kind: "navigate", to: loginUrl(asked) }
  // Un ancien user_role resté dans le navigateur ne doit pas faire croire que le refresh a
  // posé ses cookies : on l'efface d'abord, sa présence ensuite prouve l'enregistrement.
  clearRoleCookie()
  const result = await refreshSession()
  if (result.kind === "ok") {
    const role = cookieValue(readCookies(), "user_role")
    if (!role) return { kind: "navigate", to: loginUrl(asked) }
    return { kind: "navigate", to: asked ?? homeForRole(role) }
  }
  if (result.kind === "unauthorized") return { kind: "navigate", to: loginUrl(asked) }
  return {
    kind: "retry",
    message: refreshErrorMessage(result),
    retryAfter: result.kind === "rateLimited" ? result.retryAfter : null,
    loginUrl: loginUrl(asked),
  }
}

// Un corps ReadableStream est consommé au premier envoi : il ne peut pas être rejoué.
// Chaîne, Blob/File (photos), ArrayBuffer, FormData et URLSearchParams sont relus à chaque envoi.
export function isReplayableBody(body: BodyInit | null | undefined): boolean {
  return !(typeof ReadableStream !== "undefined" && body instanceof ReadableStream)
}

function redirectToLogin(): void {
  if (typeof window !== "undefined") {
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
  }
}

// Envoie la requête ; sur 401, un seul renouvellement de session puis un seul rejeu. Jamais de boucle :
// un 401 après rejeu, ou un refresh refusé (401/403), redirige vers la connexion. Refresh en 429 ou
// indisponible : ApiError 429 / 503 avec message, sans redirection (l'utilisateur garde sa saisie).
async function fetchWithRefresh(url: string, init: RequestInit, body: BodyInit | null | undefined): Promise<Response> {
  let res = await fetch(url, init)
  if (res.status === 401 && isReplayableBody(body)) {
    const refreshed = await refreshSession()
    if (refreshed.kind === "ok") res = await fetch(url, init)
    else if (refreshed.kind === "rateLimited") throw new ApiError(429, refreshErrorMessage(refreshed), refreshed.retryAfter)
    else if (refreshed.kind === "unavailable") throw new ApiError(503, refreshErrorMessage(refreshed))
  }
  if (res.status === 401) {
    redirectToLogin()
    throw new ApiError(401, "Non autorisé")
  }
  return res
}

// apiResponse exécute la requête via le proxy et lève ApiError sur tout statut non 2xx.
// Retourne la Response brute pour les appels dont le code 2xx a un sens métier (202 vs 204).
async function apiResponse(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${PROXY_BASE}${path}`

  const res = await fetchWithRefresh(url, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  }, init?.body)

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string; message?: string }
      if (body.error) message = body.error
      else if (body.message) message = body.message
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, message, parseRetryAfter(res.headers.get("retry-after")))
  }

  return res
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await apiResponse(path, init)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Geocoding Nominatim ───────────────────────────────────────────────────────

type NominatimResult = { lat: string; lon: string; display_name: string }

// Nominatim encode certains caractères dans display_name (&#39; pour l'apostrophe,
// &amp; pour &). React affiche le texte brut sans décoder les entités HTML —
// on décode ici, à la source, avant de stocker dans GeoPoint.address.
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

// Retourne jusqu'à 5 suggestions pour l'autocomplete
export async function searchAddresses(query: string): Promise<GeoPoint[]> {
  if (query.trim().length < 3) return []
  const qs = new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    countrycodes: "fr",
  })
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${qs.toString()}`,
      { headers: { "Accept-Language": "fr" } },
    )
    if (!res.ok) return []
    const data = (await res.json()) as NominatimResult[]
    return data.map((item) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: decodeHtmlEntities(item.display_name),
    }))
  } catch {
    return []
  }
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  if (address.trim().length < 5) return null
  const qs = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    countrycodes: "fr",
  })
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${qs.toString()}`,
      { headers: { "Accept-Language": "fr" } },
    )
    if (!res.ok) return null
    const data = (await res.json()) as Array<{
      lat: string
      lon: string
      display_name: string
    }>
    if (!data[0]) return null
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      address: decodeHtmlEntities(data[0].display_name),
    }
  } catch {
    return null
  }
}

// ── Devis ─────────────────────────────────────────────────────────────────────

// POST /quotes/estimate — public, pas de JWT → appel direct, pas de proxy
export async function getQuoteEstimate(body: EstimateBody): Promise<EstimateResult> {
  const res = await fetch(`${PUBLIC_API_URL}/quotes/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new ApiError(res.status, data.error ?? res.statusText)
  }
  return res.json() as Promise<EstimateResult>
}

// POST /quotes/ — authentifié
export function createSavedQuote(body: CreateQuoteBody): Promise<SavedQuote> {
  return apiFetch<SavedQuote>("/quotes", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function getQuoteById(id: string): Promise<SavedQuote> {
  return apiFetch<SavedQuote>(`/quotes/${id}`)
}

// ── Réservations ──────────────────────────────────────────────────────────────

// POST /bookings — authentifié
export function createBooking(body: CreateBookingBody): Promise<Booking> {
  return apiFetch<Booking>("/bookings", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function getMyBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/bookings/me")
}

// PUT /bookings/{id}/address — modifie les adresses et recalcule le prix
// Bloque côté serveur si la date est passée ou le statut non modifiable.
export function updateBookingAddress(
  id: string,
  body: {
    pickup_address?: string
    pickup_lat?: number
    pickup_lng?: number
    delivery_address?: string
    delivery_lat?: number
    delivery_lng?: number
  },
): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${id}/address`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export function getBookingById(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${id}`)
}

// POST /bookings/{id}/cancel — annulation par le client (JWT requis, propriétaire uniquement)
export function cancelBooking(id: string): Promise<CancellationResult> {
  return apiFetch<CancellationResult>(`/bookings/${id}/cancel`, { method: "POST" })
}

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /admin/bookings — retourne un format paginé
// Paramètres :
//   status : filtre par statut ("pending_review" | "confirmed" | "cancelled" | …)
//   date   : filtre par date de course ("today" ou "YYYY-MM-DD")
//   page, limit : pagination (défaut 1, 20)
// Sans status, les réservations cancelled et payment_failed sont exclues (active_only).
export function getAdminBookings(
  status?: string,
  date?: string,
  page = 1,
  limit = 20,
): Promise<PaginatedBookings> {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  if (date) params.set("date", date)
  params.set("page", String(page))
  params.set("limit", String(limit))
  return apiFetch<PaginatedBookings>(`/admin/bookings?${params.toString()}`)
}

export function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>("/admin/stats")
}

export function updateBookingPrice(id: string, priceHT: number): Promise<BookingWithClient> {
  return apiFetch<BookingWithClient>(`/admin/bookings/${id}/price`, {
    method: "PUT",
    body: JSON.stringify({ price_ht: priceHT }),
  })
}

// ── Admin — ajustement du prix d'une course payée ─────────────────────────────

// GET /admin/bookings/{id}/price-adjustments/preview — montants TTC débités ou remboursés (409/422 : refus)
export function previewPriceAdjustment(
  id: string,
  newPriceHT: number,
  signal?: AbortSignal,
): Promise<PriceAdjustmentPreview> {
  const params = new URLSearchParams({ new_price_ht: String(newPriceHT) })
  return apiFetch<PriceAdjustmentPreview>(
    `/admin/bookings/${id}/price-adjustments/preview?${params.toString()}`,
    { signal },
  )
}

// POST /admin/bookings/{id}/price-adjustments — 402 débit refusé (rien émis), 409/422 refus,
// 503 résultat incertain : renvoyer le même request_id (l'API rend alors le même ajustement).
export function createPriceAdjustment(
  id: string,
  body: PriceAdjustmentBody,
): Promise<{ adjustment: PriceAdjustment }> {
  return apiFetch<{ adjustment: PriceAdjustment }>(`/admin/bookings/${id}/price-adjustments`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// GET /admin/bookings/{id}/price-adjustments — historique des ajustements de la course
export function getPriceAdjustments(id: string): Promise<{ adjustments: PriceAdjustment[] }> {
  return apiFetch<{ adjustments: PriceAdjustment[] }>(`/admin/bookings/${id}/price-adjustments`)
}

// PUT /admin/bookings/{id}/confirm — 204 sans corps.
// 409 : pas en attente de validation, refus en cours, ou remboursement intégral / à vérifier.
export function confirmBooking(id: string): Promise<void> {
  return apiFetch<void>(`/admin/bookings/${id}/confirm`, {
    method: "PUT",
  })
}

// POST /admin/bookings/{id}/refund — déclenche un remboursement Stripe
export function adminRefund(
  bookingId: string,
  amountCents: number,
  reason: string,
): Promise<RefundResult> {
  return apiFetch<RefundResult>(`/admin/bookings/${bookingId}/refund`, {
    method: "POST",
    body: JSON.stringify({ amount_cents: amountCents, reason }),
  })
}

// PUT /admin/bookings/{id}/schedule — modifie la date de la course
// 422 si la date est passée, 409 si la course est terminée ou annulée
export function updateBookingSchedule(
  id: string,
  scheduledAt: string,
): Promise<BookingWithClient> {
  return apiFetch<BookingWithClient>(`/admin/bookings/${id}/schedule`, {
    method: "PUT",
    body: JSON.stringify({ scheduled_at: scheduledAt }),
  })
}

// POST /admin/bookings/{id}/cancel — annule un booking bloqué en awaiting_payment (aucun paiement capturé)
export function cancelUnpaidBooking(id: string): Promise<void> {
  return apiFetch<void>(`/admin/bookings/${id}/cancel`, { method: "POST" })
}

// POST /admin/bookings/{id}/reject — refuse un booking payé en pending_review (remboursement Stripe intégral)
export function rejectBooking(id: string): Promise<void> {
  return apiFetch<void>(`/admin/bookings/${id}/reject`, { method: "POST" })
}

// POST /admin/invoices/{id}/send — envoie la facture par email au client
export function sendInvoice(invoiceId: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/admin/invoices/${invoiceId}/send`, {
    method: "POST",
  })
}

// ── Admin — avoirs à émettre ──────────────────────────────────────────────────

// GET /admin/credit-note-retries — remboursements dont l'avoir reste à émettre
export function getCreditNoteRetries(): Promise<CreditNoteRetry[]> {
  return apiFetch<CreditNoteRetry[]>("/admin/credit-note-retries")
}

// POST /admin/credit-note-retries/{refund_key}/retry
// 201 → avoir émis et envoyé (created: true), 200 → déjà émis (created: false).
// Erreurs : 404 plus rien à émettre, 409 vérification Stripe requise, 422 aucune facture d'origine.
export function retryCreditNote(
  refundKey: string,
  confirmedInStripe: boolean,
): Promise<CreditNoteRetryResult> {
  return apiFetch<CreditNoteRetryResult>(
    `/admin/credit-note-retries/${encodeURIComponent(refundKey)}/retry`,
    {
      method: "POST",
      body: JSON.stringify({ confirmed_in_stripe: confirmedInStripe }),
    },
  )
}

// ── Admin — entreprises B2B ───────────────────────────────────────────────────

// GET /admin/companies
export function getAdminCompanies(): Promise<Company[]> {
  return apiFetch<Company[]>("/admin/companies")
}

// POST /admin/companies — crée une entreprise (name, contact_email)
export function createCompany(body: { name: string; contact_email: string }): Promise<Company> {
  return apiFetch<Company>("/admin/companies", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// POST /admin/companies/{id}/invite — envoie ou renvoie l'invitation B2B
// 409 si le compte est déjà actif
export function inviteCompany(id: string): Promise<void> {
  return apiFetch<void>(`/admin/companies/${id}/invite`, { method: "POST" })
}

// POST /admin/companies/{id}/resend-invitation — compte entreprise non activé : nouveau lien
// (l'ancien ne fonctionne plus). 409 si activé ou sans invitation, 429 + Retry-After (1 / 5 min, 5 / 24 h).
export function resendCompanyInvitation(id: string): Promise<void> {
  return apiFetch<void>(`/admin/companies/${encodeURIComponent(id)}/resend-invitation`, { method: "POST" })
}

// ── Admin — chauffeurs & partenaires ─────────────────────────────────────────

// GET /admin/drivers — liste des chauffeurs actifs
export function getAdminDrivers(): Promise<Driver[]> {
  return apiFetch<Driver[]>("/admin/drivers")
}

// POST /admin/drivers — crée un compte chauffeur CDI, retourne 201 avec mot de passe temporaire
export function createDriver(body: {
  email: string
  first_name: string
  last_name: string
  phone: string
}): Promise<DriverCreated> {
  return apiFetch<DriverCreated>("/admin/drivers", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// PUT /admin/drivers/{id} — met à jour les informations d'un chauffeur
export function updateDriver(
  id: string,
  body: { first_name: string; last_name: string; email: string; phone: string },
): Promise<Driver> {
  return apiFetch<Driver>(`/admin/drivers/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

// DELETE /admin/drivers/{id} — désactive un chauffeur (soft-delete)
export function deactivateDriver(id: string): Promise<void> {
  return apiFetch<void>(`/admin/drivers/${id}`, { method: "DELETE" })
}

// PUT /admin/bookings/{id}/assign — assigne un chauffeur à une course confirmée, ou change le
// chauffeur d'une course assignée. Retourne 409 si la course n'est ni confirmée ni assignée.
export function assignDriver(bookingId: string, driverId: string): Promise<BookingWithClient> {
  return apiFetch<BookingWithClient>(`/admin/bookings/${bookingId}/assign`, {
    method: "PUT",
    body: JSON.stringify({ driver_id: driverId }),
  })
}

// DELETE /admin/bookings/{id}/assign — retire le chauffeur d'une course assignée (204) : elle
// redevient confirmée sans chauffeur. 409 si la course n'est pas assignée.
export function unassignDriver(bookingId: string): Promise<void> {
  return apiFetch<void>(`/admin/bookings/${bookingId}/assign`, { method: "DELETE" })
}

// GET /admin/partners?status=xxx — candidatures partenaires (status optionnel)
export function getAdminPartners(status?: string): Promise<PartnerApplication[]> {
  const path = status
    ? `/admin/partners?status=${encodeURIComponent(status)}`
    : "/admin/partners"
  return apiFetch<PartnerApplication[]>(path)
}

// PUT /admin/partners/{id}/approve
export function approvePartner(id: string): Promise<PartnerApplication> {
  return apiFetch<PartnerApplication>(`/admin/partners/${id}/approve`, { method: "PUT" })
}

// PUT /admin/partners/{id}/reject
export function rejectPartner(id: string): Promise<PartnerApplication> {
  return apiFetch<PartnerApplication>(`/admin/partners/${id}/reject`, { method: "PUT" })
}

// POST /admin/partners/{id}/resend-link — candidature pending : renvoie le mail avec le lien
// d'envoi des documents. 409 si déjà traitée, 429 + Retry-After (1 / 5 min, 5 / 24 h).
export function resendPartnerLink(id: string): Promise<void> {
  return apiFetch<void>(`/admin/partners/${encodeURIComponent(id)}/resend-link`, { method: "POST" })
}

// GET /admin/partners/{id}/documents/{doc_type}
// Retourne une URL signée valide 15 min pour consulter un document légal.
// Ne jamais stocker l'URL retournée — elle expire.
export async function getPartnerDocumentUrl(
  applicationId: string,
  docType: "kbis" | "licence_mere" | "rcp" | "urssaf",
): Promise<string> {
  const data = await apiFetch<{ url: string; expires_in: number }>(
    `/admin/partners/${applicationId}/documents/${docType}`,
  )
  return data.url
}

// ── Chauffeur ─────────────────────────────────────────────────────────────────

// GET /driver/bookings/mine — courses assignées au chauffeur connecté
export function getDriverMyBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/driver/bookings/mine")
}

// POST /driver/bookings/{id}/photos/{phase} — corps brut (le fichier lui-même), max 8 Mo.
// L'API exige Content-Type image/* et Content-Length (posé par le navigateur) : pas de multipart.
// Bypass apiFetch : Content-Type ne doit pas être forcé à application/json.
export async function uploadBookingPhoto(
  bookingId: string,
  phase: "before" | "after",
  file: File,
): Promise<void> {
  // File (Blob) : relu à chaque envoi, donc rejouable après renouvellement de session
  const res = await fetchWithRefresh(`${PROXY_BASE}/driver/bookings/${bookingId}/photos/${phase}`, {
    method: "POST",
    // Type vide (certains navigateurs mobiles) : image/jpeg, format de stockage de l'API
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  }, file)
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string; message?: string }
      if (body.error) message = body.error
      else if (body.message) message = body.message
    } catch { /* ignore */ }
    throw new ApiError(res.status, message)
  }
}

// Réponse de GET …/photos : { before: [{ id, phase, url, uploaded_by, uploaded_at }], after: […] }
type BookingPhotoDTO = { url?: string | null }
type BookingPhotosDTO = {
  before?: BookingPhotoDTO[] | null
  after?: BookingPhotoDTO[] | null
}

// toBookingPhotos ne garde que les URLs signées, dans l'ordre renvoyé par l'API.
export function toBookingPhotos(raw: BookingPhotosDTO | null | undefined): BookingPhotos {
  const urls = (list?: BookingPhotoDTO[] | null): string[] =>
    (list ?? []).flatMap((p) => (typeof p?.url === "string" && p.url !== "" ? [p.url] : []))
  return { before: urls(raw?.before), after: urls(raw?.after) }
}

// GET /driver/bookings/{id}/photos — URLs signées 1h
export async function getDriverBookingPhotos(bookingId: string): Promise<BookingPhotos> {
  return toBookingPhotos(await apiFetch<BookingPhotosDTO>(`/driver/bookings/${bookingId}/photos`))
}

// POST /driver/bookings/{id}/complete — le chauffeur marque la course comme terminée (204)
export function completeBooking(id: string): Promise<void> {
  return apiFetch<void>(`/driver/bookings/${id}/complete`, { method: "POST" })
}

// GET /admin/bookings/{id}/photos — URLs signées 15 min
export async function getAdminBookingPhotos(bookingId: string): Promise<BookingPhotos> {
  return toBookingPhotos(await apiFetch<BookingPhotosDTO>(`/admin/bookings/${bookingId}/photos`))
}

// ── Auth (via Route Handler Next.js) ─────────────────────────────────────────

// Passe par /api/auth/login (Route Handler).
// Le serveur pose les cookies httpOnly et retourne 200 JSON { redirect_to: "/path" }.
// On évite le 302 qui ferait suivre fetch() vers l'origine interne du conteneur.
export async function login(
  email: string,
  password: string,
  redirectTo?: string,
): Promise<{ redirect_to: string }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, ...(redirectTo ? { redirect: redirectTo } : {}) }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new ApiError(res.status, body.error ?? "Identifiants invalides")
  }
  return res.json() as Promise<{ redirect_to: string }>
}

export async function logout(): Promise<void> {
  // access_token est httpOnly — seul le Route Handler peut l'effacer côté serveur.
  // user_role est effacé par le même Route Handler.
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {})
}

// Réponse 201 : email_verified vaut false pour un nouveau client (absent avant l'API de vérification)
export function register(body: RegisterBody): Promise<{ email_verified?: boolean }> {
  return apiFetch<{ email_verified?: boolean }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// POST /auth/accept-invitation — public, active un compte B2B depuis un token d'invitation
export function acceptInvitation(body: AcceptInvitationBody): Promise<void> {
  return apiFetch<void>("/auth/accept-invitation", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// GET /auth/verify-email?token=… — public ; via le proxy (même origine, pas de CSP à ouvrir).
// 200 { status: "verified" }, 400 jeton absent, 422 jeton invalide, expiré ou déjà utilisé.
export function verifyEmail(token: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(
    `/auth/verify-email?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  )
}

// POST /auth/resend-verification — protégé JWT. 200 { status: "sent" }, 429 avec Retry-After.
export function resendVerification(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/auth/resend-verification", {
    method: "POST",
  })
}

// ── Partenaires ───────────────────────────────────────────────────────────────

// POST /partners — public — retourne l'application créée (id nécessaire pour les uploads)
export function registerPartner(body: PartnerApplyBody): Promise<PartnerApplication> {
  return apiFetch<PartnerApplication>("/partners", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// POST /partners/{id}/documents/{doc_type}
// Appel direct (pas via proxy) — l'applicant n'est pas authentifié.
// Le backend accepte le corps brut ; Content-Length est posé automatiquement par le navigateur.
export async function uploadPartnerDocument(
  partnerId: string,
  docType: "kbis" | "licence_mere" | "rcp" | "urssaf",
  file: File,
): Promise<void> {
  const res = await fetch(
    `${PUBLIC_API_URL}/partners/${partnerId}/documents/${docType}`,
    {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    },
  )
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string; message?: string }
      if (body.error) message = body.error
      else if (body.message) message = body.message
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, message)
  }
}

// ── Contact ───────────────────────────────────────────────────────────────────

// POST /contact — public
export function sendContact(body: {
  email: string
  subject: string
  message: string
}): Promise<void> {
  return apiFetch<void>("/contact", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// ── Paiement ──────────────────────────────────────────────────────────────────

export function createPaymentIntent(bookingId: string): Promise<PaymentIntent> {
  return apiFetch<PaymentIntent>("/payments/intent", {
    method: "POST",
    body: JSON.stringify({ booking_id: bookingId }),
  })
}

export function createSetupIntent(bookingId: string): Promise<SetupIntentResponse> {
  return apiFetch<SetupIntentResponse>("/payments/setup-intent", {
    method: "POST",
    body: JSON.stringify({ booking_id: bookingId }),
  })
}

// POST /payments/confirm-setup
// 204 → carte enregistrée, débit lancé ; 202 → un débit est déjà en cours (ne pas relancer).
// Erreurs : 404 réservation introuvable ou d'un autre client, 409 réservation non payable.
export async function confirmSetupIntent(
  bookingId: string,
  paymentMethodId: string,
): Promise<ConfirmSetupResult> {
  const res = await apiResponse("/payments/confirm-setup", {
    method: "POST",
    body: JSON.stringify({ booking_id: bookingId, payment_method_id: paymentMethodId }),
  })
  return { processing: res.status === 202 }
}

// ── Tarification (admin) ──────────────────────────────────────────────────────

export function getPricingConfig(): Promise<PricingConfig[]> {
  return apiFetch<PricingConfig[]>("/admin/pricing")
}

export function updatePricing(id: string, body: Partial<PricingConfig>): Promise<PricingConfig> {
  return apiFetch<PricingConfig>(`/admin/pricing/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

// GET /admin/truck-surcharge — liste des 3 surcharges (6m3 / 12m3 / 20m3)
export function getTruckSurcharges(): Promise<TruckSurcharge[]> {
  return apiFetch<TruckSurcharge[]>("/admin/truck-surcharge")
}

// PUT /admin/truck-surcharge/{truck_type} — met à jour la surcharge HT d'un type
export function updateTruckSurcharge(
  truckType: TruckType,
  surchargeHt: number,
): Promise<TruckSurcharge> {
  return apiFetch<TruckSurcharge>(`/admin/truck-surcharge/${truckType}`, {
    method: "PUT",
    body: JSON.stringify({ surcharge_ht: surchargeHt }),
  })
}

// GET /admin/helpers-surcharge — liste des 2 configs (1 / 2 manutentionnaires)
export function getHelpersSurcharges(): Promise<HelpersSurcharge[]> {
  return apiFetch<HelpersSurcharge[]>("/admin/helpers-surcharge")
}

// PUT /admin/helpers-surcharge/{helpers_count} — met à jour le % de surcharge
export function updateHelpersSurcharge(
  helpersCount: number,
  surchargePct: number,
): Promise<HelpersSurcharge> {
  return apiFetch<HelpersSurcharge>(`/admin/helpers-surcharge/${helpersCount}`, {
    method: "PUT",
    body: JSON.stringify({ surcharge_pct: surchargePct }),
  })
}
