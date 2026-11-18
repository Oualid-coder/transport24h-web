// Validation / refus admin : contrat 204 et messages 409 de l'API (handler admin_bookings.go)
import { test } from "node:test"
import assert from "node:assert/strict"
import { confirmBooking, rejectBooking } from "../lib/api"

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

test("confirmation : 204 sans corps → résolue à undefined, sans erreur", async () => {
  const { calls, result } = await withFetch(() => new Response(null, { status: 204 }), () => confirmBooking("b1"))
  assert.equal(result, undefined)
  assert.equal(calls[0].url, "/api/proxy/admin/bookings/b1/confirm")
  assert.equal(calls[0].init.method, "PUT")
})

const confirm409 = [
  "Validation impossible : cette course a été intégralement remboursée ou un remboursement de refus est à vérifier dans Stripe.",
  "un refus est en cours sur cette réservation",
  "cette réservation n'est pas en attente de validation",
]

test("confirmation : 409 → ApiError avec le message de l'API", async () => {
  for (const msg of confirm409) {
    await assert.rejects(
      withFetch(() => Response.json({ error: msg }, { status: 409 }), () => confirmBooking("b1")),
      { name: "ApiError", status: 409, message: msg },
    )
  }
})

test("refus : 409 → ApiError avec le message de l'API", async () => {
  for (const msg of [
    "La course a été annulée entre-temps par le client ; le remboursement a été effectué.",
    "un refus est déjà en cours sur cette réservation",
  ]) {
    await assert.rejects(
      withFetch(() => Response.json({ error: msg }, { status: 409 }), () => rejectBooking("b1")),
      { name: "ApiError", status: 409, message: msg },
    )
  }
})
