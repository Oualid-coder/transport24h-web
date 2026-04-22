import type {
  AdminStats,
  AvailableBooking,
  Booking,
  BookingWithClient,
  CreateBookingBody,
  CreateQuoteBody,
  EstimateBody,
  EstimateResult,
  GeoPoint,
  PartnerApplyBody,
  PaymentIntent,
  RegisterBody,
  SavedQuote,
} from "@/lib/types"

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
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${PROXY_BASE}${path}`

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  })

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
    }
    throw new ApiError(401, "Non autorisé")
  }

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

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Geocoding Nominatim ───────────────────────────────────────────────────────

type NominatimResult = { lat: string; lon: string; display_name: string }

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
      address: item.display_name,
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
      address: data[0].display_name,
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

export function getBookingById(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${id}`)
}

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /admin/bookings?status=xxx — status optionnel : "pending_review" | "today" | omis = tous
export function getAdminBookings(status?: string): Promise<BookingWithClient[]> {
  const path = status
    ? `/admin/bookings?status=${encodeURIComponent(status)}`
    : "/admin/bookings"
  return apiFetch<BookingWithClient[]>(path)
}

export function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>("/admin/stats")
}

export function updateBookingPrice(id: string, priceHT: number): Promise<BookingWithClient> {
  return apiFetch<BookingWithClient>(`/admin/bookings/${id}/price`, {
    method: "PATCH",
    body: JSON.stringify({ price_ht: priceHT }),
  })
}

export function confirmBooking(id: string): Promise<BookingWithClient> {
  return apiFetch<BookingWithClient>(`/admin/bookings/${id}/confirm`, {
    method: "POST",
  })
}

// ── Chauffeur ─────────────────────────────────────────────────────────────────

// GET /driver/bookings/available — courses non assignées visibles par tous les chauffeurs
export function getAvailableBookings(): Promise<AvailableBooking[]> {
  return apiFetch<AvailableBooking[]>("/driver/bookings/available")
}

// POST /driver/bookings/{id}/accept — le chauffeur s'assigne la course
// Retourne 409 si un autre chauffeur vient de l'accepter en parallèle
export function acceptBooking(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/driver/bookings/${id}/accept`, { method: "POST" })
}

// GET /driver/bookings/mine — courses assignées au chauffeur connecté
export function getDriverMyBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/driver/bookings/mine")
}

// Conservées pour compatibilité — préférer getAdminBookings dans les nouveaux composants
export function getBookingsToday(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/admin/bookings/today")
}

export function getPendingReviewBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/admin/bookings/pending-review")
}

// ── Auth (via Route Handler Next.js) ─────────────────────────────────────────

// Passe par /api/auth/login (Route Handler).
// Le serveur pose les cookies et retourne un 302 — fetch le suit automatiquement.
// res.url après le follow est l'URL de destination finale (ex: /dashboard).
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
  // fetch a suivi le 302 — res.url est l'URL absolue de destination
  return { redirect_to: res.url }
}

export async function logout(): Promise<void> {
  // access_token est httpOnly — seul le Route Handler peut l'effacer côté serveur.
  // user_role est effacé par le même Route Handler.
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {})
}

export function register(body: RegisterBody): Promise<void> {
  return apiFetch<void>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// ── Partenaires ───────────────────────────────────────────────────────────────

// POST /partners/apply — public
export function registerPartner(body: PartnerApplyBody): Promise<void> {
  return apiFetch<void>("/partners/apply", {
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
