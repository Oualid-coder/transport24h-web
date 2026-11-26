// Recherche d'adresse par l'API (POST /geocode/completion et /geocode/search, Base Adresse Nationale
// via la Géoplateforme IGN). Le navigateur ne contacte aucun géocodeur tiers.
// Règle « aucun devis faux » : seules les coordonnées d'une suggestion choisie par l'internaute,
// et correspondant au texte affiché, servent au devis. Jamais de choix automatique : un champ
// quitté sans choix n'a pas d'adresse (« 5 rue de Paris Montreuil » donnait sinon le 11e
// arrondissement de Paris, « 3 rue de la Gare Saint-Denis » La Réunion).
import * as z from "@/lib/zod"
import { ApiError } from "@/lib/api"
import { transientErrorMessage } from "@/lib/error-message"
import type { GeoPoint } from "@/lib/types"

// Bornes de l'API (domain.AddressQueryMinLen / MaxLen), en caractères.
export const ADDRESS_QUERY_MIN = 3
export const ADDRESS_QUERY_MAX = 200

// Délai de frappe avant une recherche : une requête par pause, pas par touche.
export const ADDRESS_DEBOUNCE_MS = 300

export const ADDRESS_UNAVAILABLE_MESSAGE =
  "Service d'adresses momentanément indisponible. Réessayez dans quelques instants."

export const ADDRESS_CHOOSE_MESSAGE = "Choisissez votre adresse dans la liste."

export const ADDRESS_NOT_FOUND_MESSAGE = "Adresse introuvable : vérifiez-la ou choisissez une suggestion."

export interface AddressResult extends GeoPoint {
  postcode: string
  city: string
  type: string
  // Pertinence 0..1 (recherche de l'API) ; null pour l'autocomplétion.
  score: number | null
}

const resultSchema = z.object({
  label: z.string().trim().min(1).max(300),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  postcode: z.string().max(10),
  city: z.string().max(100),
  type: z.string().max(32),
  score: z.number().min(0).max(1).nullable(),
})

const responseSchema = z.object({ results: z.array(resultSchema).max(20) })

// Texte envoyé à l'API : espaces regroupées ; null hors bornes (aucune requête).
export function addressQuery(text: string): string | null {
  const q = text.replace(/\s+/g, " ").trim()
  const n = [...q].length
  return n >= ADDRESS_QUERY_MIN && n <= ADDRESS_QUERY_MAX ? q : null
}

// Réponse de l'API validée, null si elle ne respecte pas le contrat. Point 0,0 écarté.
export function parseGeocodeResponse(json: unknown): AddressResult[] | null {
  const parsed = responseSchema.safeParse(json)
  if (!parsed.success) return null
  return parsed.data.results
    .filter((r) => !(r.lat === 0 && r.lng === 0))
    .map((r) => ({
      lat: r.lat,
      lng: r.lng,
      address: r.label,
      postcode: r.postcode,
      city: r.city,
      type: r.type,
      score: r.score,
    }))
}

// Message de l'état « indisponible » (503, réseau, réponse invalide) ; 429 → délai de la gateway.
export function addressSearchErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    return transientErrorMessage(err) ?? ADDRESS_UNAVAILABLE_MESSAGE
  }
  return ADDRESS_UNAVAILABLE_MESSAGE
}

// Texte refusé par l'API (422) : pas une panne, simplement aucune suggestion.
export function isInvalidQueryError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 422
}

// Point utilisable pour un devis : coordonnées finies, dans les bornes, jamais 0,0.
export function isQuotablePoint(p: GeoPoint | null | undefined): p is GeoPoint {
  return (
    !!p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180 &&
    !(p.lat === 0 && p.lng === 0) &&
    p.address.trim().length > 0
  )
}

// Adresse retenue après une modification du texte : gardée seulement si le texte est
// exactement celui de l'adresse choisie, sinon plus aucune coordonnée (jamais d'anciennes).
export function selectionAfterEdit(selected: GeoPoint | null, text: string): GeoPoint | null {
  return selected && selected.address === text ? selected : null
}

// Texte tapé sans adresse retenue qui lui corresponde : envoi refusé (sinon le texte serait ignoré
// ou envoyé sans coordonnées).
export function isUnconfirmedAddress(text: string, point: GeoPoint | null): boolean {
  return text.trim() !== "" && (point === null || point.address !== text)
}
