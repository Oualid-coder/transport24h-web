import type {
  AuthResponse,
  Booking,
  CreateBookingInput,
  LoginInput,
  PartnerInput,
  PaymentIntent,
  QuoteEstimate,
  QuoteParams,
  RegisterInput,
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

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  })

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
    throw new ApiError(401, "Non autorisé")
  }

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Devis ────────────────────────────────────────────────────────────────────

export function getQuoteEstimate(params: QuoteParams): Promise<QuoteEstimate> {
  const qs = new URLSearchParams({
    pickupLat: String(params.pickupLat),
    pickupLng: String(params.pickupLng),
    deliveryLat: String(params.deliveryLat),
    deliveryLng: String(params.deliveryLng),
    truckType: params.truckType,
    handlers: String(params.handlers),
  })
  return apiFetch<QuoteEstimate>(`/quotes/estimate?${qs.toString()}`)
}

// ── Réservations ─────────────────────────────────────────────────────────────

export function createBooking(input: CreateBookingInput): Promise<Booking> {
  return apiFetch<Booking>("/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function getMyBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/bookings/me")
}

export function getBookingById(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${id}`)
}

// ── Admin ────────────────────────────────────────────────────────────────────

export function getBookingsToday(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/admin/bookings/today")
}

export function getPendingReviewBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/admin/bookings/pending-review")
}

export function updateBookingPrice(
  id: string,
  priceHT: number,
): Promise<Booking> {
  return apiFetch<Booking>(`/admin/bookings/${id}/price`, {
    method: "PATCH",
    body: JSON.stringify({ priceHT }),
  })
}

export function confirmBooking(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/admin/bookings/${id}/confirm`, {
    method: "POST",
  })
}

// ── Paiement ─────────────────────────────────────────────────────────────────

export function createPaymentIntent(bookingId: string): Promise<PaymentIntent> {
  return apiFetch<PaymentIntent>("/payments/intent", {
    method: "POST",
    body: JSON.stringify({ bookingId }),
  })
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function login(email: string, password: string): Promise<AuthResponse> {
  const input: LoginInput = { email, password }
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function register(input: RegisterInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" })
}

export function refreshToken(): Promise<void> {
  return apiFetch<void>("/auth/refresh", { method: "POST" })
}

// ── Partenaires ───────────────────────────────────────────────────────────────

export function registerPartner(input: PartnerInput): Promise<void> {
  return apiFetch<void>("/partners/register", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
