import { ApiError } from "@/lib/api"
import { errorMessage, looksTechnical, transientErrorMessage } from "@/lib/error-message"
import { isChargeInProgress } from "@/lib/booking-status"
import { priceChanged } from "@/lib/price"
import type { BookingWithClient, PriceAdjustment, PriceAdjustmentBody, PriceAdjustmentPreview } from "@/lib/types"

// Ajustement du prix d'une course payée (admin) : hausse débitée sur la carte enregistrée du client,
// baisse remboursée avec émission d'un avoir. Contrat : POST /admin/bookings/{id}/price-adjustments.

export const REASON_MAX_LENGTH = 500

// Course payée par carte (price_locked), hors compte entreprise, ni annulée ni en cours de débit.
export function canAdjustPrice(
  b: Pick<BookingWithClient, "price_locked" | "is_b2b" | "status">,
): boolean {
  return b.price_locked && !b.is_b2b && b.status !== "cancelled" && !isChargeInProgress(b.status)
}

// « 1 234,56 », « 120,5 », « 120.50 » → nombre ; null si invalide, nul ou plus de deux décimales.
export function parseFrenchPrice(input: string): number | null {
  const s = input.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const n = Number(s)
  return n > 0 ? n : null
}

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

// 1234 → « 12,34 € »
export function formatCents(cents: number): string {
  return euros.format(cents / 100)
}

// Longueur en caractères (et non en unités UTF-16) du motif nettoyé.
function reasonLength(reason: string): number {
  return [...reason.trim()].length
}

export interface AdjustmentForm {
  priceInput: string
  reason: string
  clientAgreed: boolean
  currentPriceHT: number
}

// Premier problème de saisie à afficher, null si le formulaire peut passer à la confirmation.
export function adjustmentFormError(f: AdjustmentForm): string | null {
  const price = parseFrenchPrice(f.priceInput)
  if (price === null) return "Nouveau prix HT invalide (ex. : 120,50)."
  if (!priceChanged(f.currentPriceHT, price)) return "Le nouveau prix est identique au prix actuel."
  if (reasonLength(f.reason) === 0) return "Le motif est requis."
  if (reasonLength(f.reason) > REASON_MAX_LENGTH)
    return `Le motif ne doit pas dépasser ${REASON_MAX_LENGTH} caractères.`
  if (!f.clientAgreed) return "Cochez « Le client a donné son accord » pour continuer."
  return null
}

// Corps envoyé : client_agreed toujours true (le corps n'est construit qu'une fois la case cochée).
export function buildAdjustmentBody(
  newPriceHT: number,
  reason: string,
  requestId: string,
): PriceAdjustmentBody {
  return { new_price_ht: newPriceHT, reason: reason.trim(), client_agreed: true, request_id: requestId }
}

// Montant et sens répétés à l'étape de confirmation ; null si le prix ne change pas.
export function confirmationQuestion(p: Pick<PriceAdjustmentPreview, "delta_cents">): string | null {
  if (p.delta_cents > 0) return `Débiter ${formatCents(p.delta_cents)} sur la carte du client ?`
  if (p.delta_cents < 0) return `Rembourser ${formatCents(-p.delta_cents)} au client ?`
  return null
}

export const UNCERTAIN_MESSAGE =
  "Résultat incertain : l'ajustement a peut-être été effectué. Cliquez sur « Réessayer » : " +
  "le nouvel essai ne débitera ni ne remboursera deux fois."

const DECLINED_MESSAGE =
  "Opération refusée par la banque : rien n'a été débité, remboursé ni émis, le prix est inchangé."
const FALLBACK = "L'ajustement n'a pas pu être effectué."
export const STOPPED_MESSAGE =
  "Opération arrêtée : vérifiez la course, l'historique et Stripe avant toute nouvelle action."

// uncertain : l'opération a pu avoir lieu (503, 500, réseau…) → même request_id, champs verrouillés, seul
// « Réessayer » est proposé (l'API est idempotente : un request_id terminé renvoie 200 avec son statut final).
// definitive : rien n'a été fait → nouvel request_id, champs modifiables.
// stopped : 409 « interrompu depuis plus de 23 h » ou conflit de paramètres sur le request_id (notamment la
// reprise par un autre admin que celui qui a lancé l'opération) → plus aucun envoi dans cette modale.
export type AdjustmentFailureKind = "uncertain" | "definitive" | "stopped"

// 409 de l'API qu'aucun nouvel essai ne peut lever : « Ajustement interrompu depuis plus de 23 h : à vérifier
// dans Stripe… » et « Cette demande a déjà été envoyée avec d'autres paramètres. » (l'API compare aussi l'admin).
function isFinalConflict(err: ApiError): boolean {
  return /interrompu depuis plus de|d[ée]j[àa] [ée]t[ée] envoy[ée]e avec d.autres param[èe]tres/i.test(err.message)
}

// Message de l'API s'il est présentable (phrase française), sinon le repli.
function apiMessage(err: ApiError, fallback: string): string {
  const msg = err.message.trim()
  if (!msg || looksTechnical(msg)) return fallback
  return msg.charAt(0).toUpperCase() + msg.slice(1)
}

// Erreur du POST. `retrying` : un essai précédent de la même opération a déjà eu un résultat incertain
// (un 409 « ajustement en cours » peut alors être ce même essai : on reste en attente du même request_id).
export function adjustmentFailure(
  err: unknown,
  retrying: boolean,
): { kind: AdjustmentFailureKind; message: string } {
  if (!(err instanceof ApiError)) return { kind: "uncertain", message: UNCERTAIN_MESSAGE }
  if (err.status === 402) return { kind: "definitive", message: apiMessage(err, DECLINED_MESSAGE) }
  if (err.status === 500) return { kind: "uncertain", message: apiMessage(err, UNCERTAIN_MESSAGE) }
  if (err.status === 409 && isFinalConflict(err)) return { kind: "stopped", message: apiMessage(err, STOPPED_MESSAGE) }
  if (err.status === 429) return { kind: "uncertain", message: transientErrorMessage(err) ?? UNCERTAIN_MESSAGE }
  if (err.status === 401 || err.status >= 500) return { kind: "uncertain", message: UNCERTAIN_MESSAGE }
  if (err.status === 409 && retrying) return { kind: "uncertain", message: errorMessage(err, UNCERTAIN_MESSAGE) }
  return { kind: "definitive", message: errorMessage(err, FALLBACK) }
}

// request_id de la tentative suivante : conservé après un résultat incertain, neuf sinon (refus définitif,
// arrêt : la prochaine opération sera une nouvelle ouverture, après vérification).
export interface AttemptState {
  requestId: string
  locked: boolean
}

export function attemptAfterFailure(
  state: AttemptState,
  kind: AdjustmentFailureKind,
  newId: () => string,
): AttemptState {
  return kind === "uncertain" ? { requestId: state.requestId, locked: true } : { requestId: newId(), locked: false }
}

// À l'ouverture de la modale : une opération au résultat incertain se reprend avec le même request_id ;
// sinon (première ouverture, succès, refus définitif) nouvelle opération, nouvel request_id.
export function attemptOnOpen(state: AttemptState | null, newId: () => string): AttemptState {
  return state?.locked ? state : { requestId: newId(), locked: false }
}

// Reprise d'une ligne « pending » de l'historique : exactement ses paramètres et son request_id
// (l'API refuse en 409 un même request_id avec d'autres paramètres).
export function resumeBody(
  a: Pick<PriceAdjustment, "new_price_ht" | "reason" | "request_id">,
): PriceAdjustmentBody {
  return { new_price_ht: a.new_price_ht, reason: a.reason, client_agreed: true, request_id: a.request_id }
}

export type AdjustmentOutcome = "succeeded" | "pending" | "failed"

// Statut renvoyé par un POST en 200 : « failed » est possible quand un request_id terminé est rejoué.
// Tout statut inconnu est traité comme « pending » (jamais présenté comme un succès).
export function adjustmentOutcome(status: string): AdjustmentOutcome {
  return status === "succeeded" || status === "failed" ? status : "pending"
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "En cours",
  succeeded: "Effectué",
  failed: "Échoué",
}

// Baisse supérieure au remboursable (encaissé − déjà remboursé) : l'API la refuse (409), on le dit avant.
export function previewBlocker(
  p: Pick<PriceAdjustmentPreview, "delta_cents" | "refundable_cents">,
): string | null {
  if (p.delta_cents < 0 && -p.delta_cents > p.refundable_cents)
    return `Baisse impossible : au plus ${formatCents(p.refundable_cents)} peuvent encore être remboursés au client.`
  return null
}

// Message d'erreur de l'aperçu (409/422 : refus métier de l'API).
export function previewErrorMessage(err: unknown): string {
  return errorMessage(err, "Aperçu indisponible pour ce prix.")
}
