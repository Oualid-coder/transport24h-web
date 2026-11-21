// Seul l'admin affecte, change et retire le chauffeur (PUT et DELETE /admin/bookings/{id}/assign,
// handler admin_drivers.go). Le chauffeur ne peut plus se désister en ligne. Lancer : npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { ApiError, unassignDriver } from "../lib/api"
import { errorMessage } from "../lib/error-message"
import {
  DRIVER_WITHDRAWAL_MESSAGE,
  assignDriverLabel,
  canUnassignDriver,
  unassignConfirmText,
} from "../lib/driver-assignment"
import type { BookingStatus } from "../lib/types"

const ALL: BookingStatus[] = [
  "awaiting_payment", "payment_processing", "payment_failed", "pending_review",
  "confirmed", "assigned", "done", "cancelled",
]

async function withFetch<T>(response: () => Response, run: () => Promise<T>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return response()
  }) as typeof fetch // signature simplifiée suffisante pour le test
  try {
    return { calls, result: await run() }
  } finally {
    globalThis.fetch = original
  }
}

test("admin : « Changer de chauffeur » sur une course assignée, « Assigner un chauffeur » sinon", () => {
  for (const s of ALL) {
    assert.equal(assignDriverLabel(s), s === "assigned" ? "Changer de chauffeur" : "Assigner un chauffeur", s)
  }
})

test("admin : « Retirer le chauffeur » seulement sur une course assignée", () => {
  for (const s of ALL) assert.equal(canUnassignDriver(s), s === "assigned", s)
})

test("admin : texte de confirmation (mail au chauffeur retiré, sauf course entreprise)", () => {
  assert.match(unassignConfirmText(false), /redevient confirmée sans chauffeur/)
  assert.match(unassignConfirmText(false), /Le chauffeur retiré est prévenu par e-mail\./)
  assert.match(unassignConfirmText(true), /n'est pas prévenu par e-mail/)
  assert.doesNotMatch(unassignConfirmText(true), /Le chauffeur retiré est prévenu par e-mail/)
})

test("unassignDriver : DELETE /admin/bookings/{id}/assign via le proxy, 204 → undefined", async () => {
  const { calls, result } = await withFetch(() => new Response(null, { status: 204 }), () => unassignDriver("b1"))
  assert.equal(result, undefined)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "/api/proxy/admin/bookings/b1/assign")
  assert.equal(calls[0].init.method, "DELETE")
})

test("unassignDriver : 409 → message de l'API affiché", async () => {
  const msg = "aucun chauffeur à retirer : la course n'est pas en statut assigné"
  const err = await withFetch(() => Response.json({ error: msg }, { status: 409 }), () => unassignDriver("b1"))
    .then(() => null, (e: unknown) => e)
  assert.ok(err instanceof ApiError && err.status === 409)
  assert.equal(errorMessage(err, "repli"), "Aucun chauffeur à retirer : la course n'est pas en statut assigné")
})

test("carte admin : bouton « Retirer le chauffeur » avec confirmation, libellé de réaffectation", () => {
  const src = readFileSync(new URL("../components/admin/BookingCard.tsx", import.meta.url), "utf8")
  assert.ok(src.includes("Retirer le chauffeur"))
  assert.ok(src.includes("Confirmer le retrait"))
  assert.ok(src.includes("canUnassignDriver(booking.status)"))
  assert.ok(src.includes("assignDriverLabel(booking.status)"))
  // le retrait ne part qu'après confirmation (dans la modale), pas au clic du bouton de la carte
  assert.ok(/onClick=\{\(\) => unassignMutation\.mutate\(\)\}/.test(src))
  assert.equal(src.match(/unassignMutation\.mutate\(/g)?.length, 1)
})

test("espace chauffeur : aucun appel de désistement, message vers l'administrateur et contact du site", () => {
  const api = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8")
  assert.ok(!/\/driver\/bookings\/[^"`]*\/cancel/.test(api))
  const page = readFileSync(new URL("../app/(driver)/driver/dashboard/page.tsx", import.meta.url), "utf8")
  assert.ok(page.includes("{DRIVER_WITHDRAWAL_MESSAGE}"))
  assert.ok(page.includes('href="/contact"'))
  assert.ok(page.includes('href="mailto:contact@transport24h.fr"'))
  assert.ok(!/Libérer|Se désister|Annuler la course/.test(page))
  assert.equal(DRIVER_WITHDRAWAL_MESSAGE, "Pour vous désister d'une course, contactez l'administrateur\u00a0:")
})

test("page partenaires : plus de choix des créneaux ni de la zone par le chauffeur", () => {
  const src = readFileSync(new URL("../app/partners/page.tsx", import.meta.url), "utf8")
  assert.ok(!src.includes("Choisissez vos créneaux"))
  assert.ok(!src.includes("Missions flexibles"))
  assert.ok(src.includes("Notre équipe vous affecte les courses"))
})
