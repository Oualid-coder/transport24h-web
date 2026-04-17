export type TruckType = "12m3" | "16m3" | "20m3"

export const TRUCK_VOLUME: Record<TruckType, number> = {
  "12m3": 12,
  "16m3": 16,
  "20m3": 20,
}

export type BookingStatus =
  | "pending_review"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"

export type UserRole = "client" | "admin" | "driver"

// ── Localisation ──────────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number
  lng: number
  address: string
}

// ── Devis / Estimation ────────────────────────────────────────────────────────

// Body vers POST /quotes/estimate — snake_case, mirrors Go estimateRequest
export interface EstimateBody {
  pickup_lat: number
  pickup_lng: number
  delivery_lat: number
  delivery_lng: number
  volume_m3: number
  helpers_count: number
  truck_type: TruckType
}

// Réponse de POST /quotes/estimate — mirrors Go EstimateResult
export interface EstimateResult {
  distance_km: number
  volume_m3: number
  helpers_count: number
  price_ht: number
}

// Body vers POST /quotes/ (authentifié) — mirrors Go createQuoteRequest
export interface CreateQuoteBody {
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  delivery_address: string
  delivery_lat: number
  delivery_lng: number
  volume_m3: number
  helpers_count: number
  truck_type: TruckType
}

// Réponse de POST /quotes/ — mirrors Go quoteResponse
export interface SavedQuote {
  id: string
  pickup_address: string
  delivery_address: string
  distance_km: number
  volume_m3: number
  helpers_count: number
  price_ht: number
  status: string
  expires_at: string
  created_at: string
}

// ── Réservations ──────────────────────────────────────────────────────────────

// Body vers POST /bookings — mirrors Go createBookingRequest
export interface CreateBookingBody {
  quote_id: string
  scheduled_at: string   // RFC3339, ex: "2026-04-20T09:00:00Z"
  client_comment?: string
}

// Réponse complète d'un booking (Go retourne les champs du devis dénormalisés)
export interface Booking {
  id: string
  status: BookingStatus
  quote_id: string
  // Dénormalisé depuis le devis lié
  pickup_address: string
  delivery_address: string
  distance_km: number
  volume_m3: number
  helpers_count: number
  truck_type: TruckType
  price_ht: number
  // Booking proprement dit
  scheduled_at: string
  client_comment?: string
  client_phone?: string
  created_at: string
  updated_at: string
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string
  password: string
}

// Réponse de POST /auth/login (via le Route Handler Next.js)
export interface LoginResponse {
  ok: true
}

export interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  role: UserRole
  createdAt: string
}

// ── Partenaires ───────────────────────────────────────────────────────────────

// Body vers POST /partners/apply — mirrors Go CreateApplicationInput
export interface PartnerApplyBody {
  first_name: string
  last_name: string
  email: string
  phone: string
  siret: string
  truck_type: TruckType
}

// ── Paiement ──────────────────────────────────────────────────────────────────

export interface PaymentIntent {
  clientSecret: string
  amount: number
  currency: string
}

// ── Config tarification (admin) ───────────────────────────────────────────────

export interface PricingConfig {
  pricePerKmTier1: number
  pricePerKmTier2: number
  pricePerKmTier3: number
  truckPricePerM3: Record<TruckType, number>
  handlerHourlyRate: number
}
