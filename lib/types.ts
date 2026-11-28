export type TruckType = "6m3" | "12m3" | "20m3"

export const TRUCK_VOLUME: Record<TruckType, number> = {
  "6m3": 6,
  "12m3": 12,
  "20m3": 20,
}

export type BookingStatus =
  | "awaiting_payment"
  | "payment_processing" // débit Stripe en cours — annulation, remboursement, prix et adresse bloqués (409)
  | "payment_failed"
  | "pending_review"
  | "confirmed"
  | "assigned"
  | "done"
  | "cancelled"

export type UserRole = "client" | "admin" | "driver" | "b2b"

// ── Chauffeur (retourné par /admin/drivers) ───────────────────────────────────

export type DriverEmploymentType = "employee" | "partner"

export interface Driver {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  employment_type: DriverEmploymentType
  application_id?: string
}

// Réponse de POST /admin/drivers : plus de mot de passe, le chauffeur reçoit une invitation
// par e-mail. invitation_sent = false : compte créé mais mail non parti (à renvoyer).
export interface DriverCreated {
  id: string
  email: string
  first_name: string
  last_name: string
  invitation_sent?: boolean
  created_at: string
}

// GET /admin/drivers/invitations : chauffeurs (CDI ou partenaires approuvés) qui n'ont pas
// encore activé leur compte.
export interface DriverInvitation {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  employment_type: DriverEmploymentType
  application_id?: string
  invitation_status: "invited" | "expired"
  created_at: string
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
  documents_count: number
  kbis_uploaded: boolean
  licence_mere_uploaded: boolean
  rcp_uploaded: boolean
  urssaf_uploaded: boolean
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
  vat_rate: number   // taux TVA en %, ex. 20.00
  price_ttc: number  // price_ht × (1 + vat_rate/100)
  // Booking proprement dit
  scheduled_at: string
  client_comment?: string
  client_phone?: string
  created_at: string
  updated_at: string
  // Course payée ou débit en cours (domain.IsPriceLocked de l'API, jamais pour une course B2B).
  // Absent avec une API antérieure : traiter comme false.
  price_locked?: boolean
}

export interface BookingPhotos {
  before: string[]
  after: string[]
}

// ── Admin ─────────────────────────────────────────────────────────────────────

// Statut du dernier paiement (API admin) — succeeded est normalisé en paid par l'API
export type PaymentStatus = "paid" | "pending" | "failed" | "refunded" | "none"

// Valeurs renvoyées par GET /admin/companies (domain.InvitationStatus côté API : "invited", pas "sent")
export type InvitationStatus = "not_invited" | "invited" | "expired" | "active"

export interface Company {
  id: string
  name: string
  contact_email: string
  invitation_status: InvitationStatus
  created_at: string
  invited_at?: string
}

// Réponse de POST /admin/companies (createCompany côté API : id, name, created_at seulement)
export interface CreatedCompany {
  id: string
  name: string
  created_at: string
}

// Body vers POST /admin/companies/{id}/invite (inviteB2BUserRequest côté API)
export interface InviteCompanyBody {
  email: string
  first_name: string
  last_name: string
}

// Booking enrichi retourné par les endpoints admin — inclut les infos client
// et le statut de paiement. Étend Booking en rendant client_phone requis.
export interface BookingWithClient extends Omit<Booking, "client_phone"> {
  client_phone: string
  client_first_name: string
  client_last_name: string
  client_email: string
  payment_status: PaymentStatus
  price_locked: boolean // true → modification directe du prix refusée par l'API (409)
  is_b2b: boolean      // course d'un compte entreprise (facturée hors application)
  last4?: string       // 4 derniers chiffres CB — présent si payment_status === "paid"
  invoice_id?: string  // présent si une facture (FACT ou AVOIR) a été générée
  // Chauffeur affecté : null sans chauffeur ; absents avec une API antérieure (traiter comme null).
  driver_first_name?: string | null
  driver_last_name?: string | null
}

// ── Admin — ajustement du prix d'une course payée ─────────────────────────────

export type PriceAdjustmentDirection = "increase" | "decrease"

// Réponse de GET /admin/bookings/{id}/price-adjustments/preview
export interface PriceAdjustmentPreview {
  old_price_ht: number
  new_price_ht: number
  old_price_ttc_cents: number
  new_price_ttc_cents: number
  delta_cents: number // > 0 : hausse débitée sur la carte, < 0 : baisse remboursée
  direction: PriceAdjustmentDirection
  charged_cents: number
  refundable_cents: number
}

// Corps de POST /admin/bookings/{id}/price-adjustments
export interface PriceAdjustmentBody {
  new_price_ht: number
  reason: string
  client_agreed: true
  request_id: string // UUID v4 : le même pour chaque nouvel essai de la même opération
}

export interface PriceAdjustment {
  id: string
  booking_id: string
  direction: PriceAdjustmentDirection
  old_price_ht: number
  new_price_ht: number
  delta_cents: number
  status: string
  reason: string
  admin_id: string
  created_at: string
  completed_at?: string | null
  credit_note_number?: string | null
  invoice_number?: string | null
  request_id: string              // pour reprendre une ligne « pending » avec le même identifiant
  step?: string                   // étape atteinte (texte de l'API)
  failure_reason?: string | null  // cause d'un « failed »
  // Clôture par l'admin d'une ligne bloquée : issues acceptées maintenant ([] ou absent : pas de bouton)
  closable_outcomes?: PriceAdjustmentCloseOutcome[]
  closed_by?: string | null
  closed_at?: string | null
  closure_outcome?: PriceAdjustmentCloseOutcome | null
  closure_reason?: string | null
  // Baisse réservée : parts du remboursement réparti (ordre de saisie de l'issue « partial »)
  refund_parts?: PriceAdjustmentRefundPart[]
}

export interface PriceAdjustmentRefundPart {
  payment_intent: string
  amount_cents: number
}

// not_executed : aucun débit / remboursement constaté dans Stripe ; executed : opération constatée ;
// partial : baisse répartie remboursée en partie seulement.
export type PriceAdjustmentCloseOutcome = "not_executed" | "executed" | "partial"

// Corps de POST /admin/bookings/{id}/price-adjustments/{adjustment_id}/close
export interface PriceAdjustmentCloseBody {
  outcome: PriceAdjustmentCloseOutcome
  reason: string
  stripe_ids?: string // executed : pi_… (hausse) ou re_…[,re_…] (baisse)
  refund_parts?: string[] // partial : re_… ou "" (non exécutée), une entrée par part
  confirmed_in_stripe: true
}

export interface PaginatedBookings {
  bookings: BookingWithClient[]
  total: number
  page: number
  limit: number
}

export interface RefundResult {
  status: string        // "refunded"
  amount_cents: number
  reason: string
}

// Réponse de POST /bookings/{id}/cancel — retournée par le handler Cancel
export interface CancellationResult {
  refund_percent: number        // 0 | 50 | 100
  refund_amount_cents: number   // 0 si refund_failed ou palier 0 % ou jamais payé
  refund_failed: boolean        // true si Stripe a rejeté — action admin requise
  refund_message?: string       // message à afficher au client (présent notamment si refund_failed)
}

// Réponse de POST /payments/confirm-setup : 204 = carte enregistrée et débit lancé,
// 202 = un débit est déjà en cours pour cette réservation (ne pas relancer).
export interface ConfirmSetupResult {
  processing: boolean
}

// ── Admin — avoirs à émettre ──────────────────────────────────────────────────

// avoir_failed : remboursement confirmé, avoir non émis.
// refund_ambiguous : issue du remboursement inconnue — à vérifier dans Stripe avant d'émettre.
export type CreditNoteRetryReason = "avoir_failed" | "refund_ambiguous"

// Ligne de GET /admin/credit-note-retries — mirrors Go creditNoteRetryResponse
export interface CreditNoteRetry {
  booking_id: string
  refund_key: string
  stripe_refund_id?: string
  amount_cents: number
  reason: CreditNoteRetryReason
  last_error?: string
  attempts: number
  created_at: string
  updated_at: string
  resolved_at?: string
}

// Réponse 201 / 200 de POST /admin/credit-note-retries/{refund_key}/retry
export interface CreditNoteRetryResult {
  credit_note_id: string
  credit_note_number: string
  amount_ttc: number
  created: boolean // true = avoir émis et envoyé (201), false = déjà émis (200)
}

// ── Rapprochement Stripe (remboursements faits hors de l'application) ─────────

// Origine d'un remboursement : "app" créé par l'application, "external" hors application,
// "" jamais vu par le webhook et sans marque de l'application.
export type StripeRefundOrigin = "app" | "external" | ""

// Ligne de GET /admin/stripe-reconciliation — mirrors Go stripeReconciliationRowResponse
export interface StripeReconciliationRow {
  stripe_refund_id: string
  amount_cents: number
  currency: string
  status: string
  created: string
  payment_intent_id: string
  booking_id: string | null
  booking_reference: string
  origin: StripeRefundOrigin
  before_cutoff: boolean
  can_issue: boolean
  blocker?: string
  notice?: string
  // Montant ajouté au total remboursé de la course si l'avoir est émis (le reste y figure déjà).
  count_cents: number
}

// Mise en service des avoirs automatiques : cutoff_at null = pas encore activés.
export interface StripeRefundSettings {
  cutoff_at: string | null
  activated_by: string | null
  activated_at: string | null
}

export interface StripeReconciliation {
  since: string
  settings: StripeRefundSettings
  truncated: boolean
  refunds: StripeReconciliationRow[]
}

// Réponse 201 / 200 de POST /admin/stripe-reconciliation/{re_…}/credit-note
export interface StripeRefundCreditNoteResult extends CreditNoteRetryResult {
  counted_cents: number
}

// Réponse 201 (activés) / 200 (déjà actifs) de POST /admin/stripe-reconciliation/activate
export interface StripeActivationResult {
  settings: StripeRefundSettings
  activated: boolean
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
  // Case « 18 ans + CGV + confidentialité » cochée. La date est posée par le serveur.
  terms_accepted?: boolean
  terms_version?: string
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
  // Case « 18 ans + CGV + confidentialité » cochée. La date est posée par le serveur.
  terms_accepted?: boolean
  terms_version?: string
}

// Body vers POST /auth/accept-invitation (activation d'un compte entreprise invité)
export interface AcceptInvitationBody {
  token: string
  password: string
  // Case « 18 ans + CGV + confidentialité » cochée. La date est posée par le serveur.
  terms_accepted?: boolean
  terms_version?: string
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

export interface TruckSurcharge {
  truck_type: TruckType
  surcharge_ht: number
}

export interface HelpersSurcharge {
  helpers_count: number
  surcharge_pct: number
}

export interface PricingConfig {
  id: string
  label: string
  distance_min_km: number
  distance_max_km: number | null
  price_fixed: number | null
  price_per_km: number | null
  is_fixed_price: boolean
}

// ── Relevé des courses d'une entreprise (contrat du sujet 17) ─────────────────

// GET /admin/companies/{id}
export interface CompanyDetail {
  id: string
  name: string
  siret: string | null
  contact_phone: string | null
  created_at: string
}

export type ReportView = "admin" | "company"
export type ReportStatusFilter = "all" | "done" | "cancelled" | "upcoming"
export type ReportHistoryType =
  | "address"
  | "schedule"
  | "driver_assigned"
  | "driver_changed"
  | "driver_unassigned"

export interface ReportBooking {
  id: string
  reference: string
  created_at: string
  created_by: { first_name: string; last_name: string; email: string } | null
  scheduled_at: string
  completed_at: string | null
  completed_at_recorded: boolean   // false : course antérieure à l'enregistrement (« non enregistré »)
  pickup_address: string
  delivery_address: string
  distance_km: number
  volume_m3: number
  truck_type: string | null
  helpers_count: number
  client_comment: string | null
  driver: { first_name: string; last_name: string | null } | null   // vue company : last_name null
  status: string
  cancelled_at: string | null
  cancel_notice_minutes: number | null   // délai restant avant la course au moment de l'annulation
  history_recorded: boolean
  history: { at: string; type: ReportHistoryType | string; detail: string }[]
  photos: { before: boolean; after: boolean; admin_url: string | null }
  // Vue admin seulement : clé absente en vue company
  reference_price?: { ht: number; vat_rate: number; ttc: number; indicative: true }
}

export interface ReportTotals {
  count: number
  by_status: { done: number; cancelled: number; upcoming: number; other: number }
  distance_km: number
  volume_m3: number
  // Vue admin seulement : clés absentes en vue company
  reference_price_ht?: number
  reference_price_ttc?: number
}

// GET /admin/companies/{id}/bookings-report et GET /b2b/bookings-report
export interface BookingsReport {
  view: ReportView
  company: { id: string; name: string }
  period: { from: string; to: string; timezone: string }
  generated_at: string
  bookings: ReportBooking[]
  totals: ReportTotals
}
