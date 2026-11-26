import { ApiError } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"
import type { PartnerStatus } from "@/lib/types"

// Refus d'une candidature partenaire (PUT /admin/partners/{id}/reject).
// En attente : refus direct, comme avant. Approuvée : l'API désactive aussi le compte chauffeur
// créé à l'approbation et coupe toutes ses sessions, ou répond 409 s'il a encore des courses
// non terminées (rien n'est modifié) : confirmation en deux étapes.
// Déjà rejetée : aucun bouton (l'API accepte un second refus, sans effet sur un compte déjà inactif).

export function rejectNeedsConfirmation(status: PartnerStatus): boolean {
  return status === "approved"
}

export const REJECT_APPROVED_TITLE = "Refuser cette candidature approuvée ?"

export const REJECT_APPROVED_CONSEQUENCES: readonly string[] = [
  "Le compte chauffeur créé à l'approbation sera désactivé : il ne pourra plus se connecter.",
  "Toutes ses sessions ouvertes seront coupées immédiatement, sur tous ses appareils.",
  "S'il a encore des courses affectées non terminées, le refus sera bloqué : réaffectez-les à un autre chauffeur, ou faites-les clôturer par le chauffeur, avant de refuser.",
]

// 409 (courses non terminées) et autres messages métier de l'API via errorMessage ; sinon repli.
export function rejectErrorMessage(err: unknown): string {
  return errorMessage(err, "La candidature n'a pas pu être rejetée. Réessayez.")
}

// Après un échec d'approbation ou de refus : 409 (candidature refusée pendant l'approbation,
// état changé) ou 404 (disparue) → relire la liste ; erreur réseau, 5xx, 429 : rien n'a changé
// de façon connue, la carte reste telle quelle.
export function decisionErrorNeedsRefresh(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 409 || err.status === 404)
}
