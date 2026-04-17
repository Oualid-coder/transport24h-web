import type {
  Booking,
  CreateBookingBody,
  CreateQuoteBody,
  EstimateBody,
  EstimateResult,
  GeoPoint,
  PartnerApplyBody,
  PaymentIntent,
  SavedQuote,
} from "@/lib/types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// Lit le token JWT stocké dans le cookie access_token (non-httpOnly)
function getAccessToken(): string | undefined {
  if (typeof document === "undefined") return undefined
  const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const token = getAccessToken()

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

// POST /quotes/estimate — public, pas de JWT
export function getQuoteEstimate(body: EstimateBody): Promise<EstimateResult> {
  return apiFetch<EstimateResult>("/quotes/estimate", {
    method: "POST",
    body: JSON.stringify(body),
  })
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

export function getBookingsToday(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/admin/bookings/today")
}

export function getPendingReviewBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/admin/bookings/pending-review")
}

export function updateBookingPrice(id: string, priceHT: number): Promise<Booking> {
  return apiFetch<Booking>(`/admin/bookings/${id}/price`, {
    method: "PATCH",
    body: JSON.stringify({ price_ht: priceHT }),
  })
}

export function confirmBooking(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/admin/bookings/${id}/confirm`, {
    method: "POST",
  })
}

// ── Auth (via Route Handler Next.js) ─────────────────────────────────────────

// Passe par /api/auth/login qui stocke l'access_token en cookie
export async function login(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new ApiError(res.status, body.error ?? "Identifiants invalides")
  }
}

export async function logout(): Promise<void> {
  // Suppression côté client
  document.cookie = "access_token=; path=/; max-age=0"
  // Optionnel: notifier le backend pour invalider le refresh_token
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {})
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
