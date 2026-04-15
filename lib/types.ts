export type TruckType = "12m3" | "16m3" | "20m3"

export type BookingStatus =
  | "pending_review"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"

export type UserRole = "client" | "admin" | "driver"

export interface QuoteParams {
  pickupLat: number
  pickupLng: number
  deliveryLat: number
  deliveryLng: number
  truckType: TruckType
  handlers: number
}

export interface QuoteEstimate {
  distanceKm: number
  durationMin: number
  priceHT: number
  priceTTC: number
  truckType: TruckType
  handlers: number
}

export interface GeoPoint {
  lat: number
  lng: number
  address: string
}

export interface Booking {
  id: string
  status: BookingStatus
  pickupAddress: string
  deliveryAddress: string
  pickupLat: number
  pickupLng: number
  deliveryLat: number
  deliveryLng: number
  scheduledAt: string
  truckType: TruckType
  handlers: number
  priceHT: number
  priceTTC: number
  clientPhone: string
  comment?: string
  clientId: string
  driverId?: string
  createdAt: string
  updatedAt: string
}

export interface CreateBookingInput {
  pickupLat: number
  pickupLng: number
  pickupAddress: string
  deliveryLat: number
  deliveryLng: number
  deliveryAddress: string
  truckType: TruckType
  handlers: number
  scheduledAt: string
  clientPhone: string
  comment?: string
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

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
}

export interface AuthResponse {
  user: User
}

export interface PaymentIntent {
  clientSecret: string
  amount: number
  currency: string
}

export interface PricingConfig {
  pricePerKmTier1: number // 0-20km
  pricePerKmTier2: number // 20-50km
  pricePerKmTier3: number // 50km+
  truckPricePerM3: Record<TruckType, number>
  handlerHourlyRate: number
}

export interface PartnerInput {
  firstName: string
  lastName: string
  phone: string
  siret: string
  truckType: TruckType
  email: string
}
