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

// ── Chauffeur (retourné par /admin/drivers) ───────────────────────────────────

export interface Driver {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
}

// ── Candidature partenaire ────────────────────────────────────────────────────

export type PartnerStatus = "pending" | "approved" | "rejected"

export interface PartnerApplication {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  siret: string
  truck_type: TruckType
  status: PartnerStatus
  created_at: string
}

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

// Course disponible visible par les chauffeurs avant acceptation
// (pas de données client — elles sont masquées tant que la course n'est pas assignée)
export interface AvailableBooking {
  id: string
  pickup_address: string
  delivery_address: string
  distance_km: number
  volume_m3: number
  helpers_count: number
  truck_type: TruckType
  price_ht: number
  scheduled_at: string
}

// Body vers POST /bookings — mirrors Go createBookingRequest
export interface CreateBookingBody {
  quote_id: string
  scheduled_at: string   // RFC3339, ex: "2026-04-20T09:00:00Z"
  client_comment?: string
}

// Réponse complète d'un booking (Go retourne les champs du devis dénormalisés)
export interface Booking {
  id: string
  reference: string      // ex: "T24H-2026-0001" — référence lisible retournée par l'API
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

// ── Admin ─────────────────────────────────────────────────────────────────────

export type PaymentStatus = "paid" | "pending" | "none"

// Booking enrichi retourné par les endpoints admin — inclut les infos client
// et le statut de paiement. Étend Booking en rendant client_phone requis.
export interface BookingWithClient extends Omit<Booking, "client_phone"> {
  client_phone: string
  client_first_name: string
  client_last_name: string
  client_email: string
  payment_status: PaymentStatus
  last4?: string    // 4 derniers chiffres CB — présent si payment_status === "paid"
  price_ttc: number // price_ht × 1.20 calculé côté backend
}

export interface AdminStats {
  revenue_today: number   // CA du jour en € HT
  bookings_today: number  // nombre total de courses du jour
  pending_count: number   // courses en attente de validation
  paid_count: number      // courses avec paiement reçu
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

// Body vers POST /auth/register — snake_case
export interface RegisterBody {
  email: string
  password: string
  first_name: string
  last_name: string
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

export interface SetupIntentResponse {
  client_secret: string
}

// ── Config tarification (admin) ───────────────────────────────────────────────

export interface PricingConfig {
  pricePerKmTier1: number
  pricePerKmTier2: number
  pricePerKmTier3: number
  truckPricePerM3: Record<TruckType, number>
  handlerHourlyRate: number
}
