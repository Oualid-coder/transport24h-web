// Espace chauffeur : seul l'admin voit les courses non affectées et les affecte. Le chauffeur ne voit
// que ses courses (GET /driver/bookings/mine) et n'appelle plus /available ni /accept. Lancer : npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as api from "../lib/api"

test("lib/api : plus de fonction de liste des courses disponibles ni d'acceptation", () => {
  assert.ok(!("getAvailableBookings" in api))
  assert.ok(!("acceptBooking" in api))
  const src = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8")
  assert.ok(!src.includes("/driver/bookings/available"))
  assert.ok(!/\/driver\/bookings\/[^"`]*\/accept/.test(src))
})

test("dashboard chauffeur : ni section « Courses disponibles » ni bouton « Accepter »", () => {
  const src = readFileSync(new URL("../app/(driver)/driver/dashboard/page.tsx", import.meta.url), "utf8")
  assert.ok(!src.includes("Courses disponibles"))
  assert.ok(!src.includes("Accepter"))
  assert.ok(!src.includes("getAvailableBookings"))
  assert.ok(src.includes("getDriverMyBookings"))
})

test("getDriverMyBookings : GET /driver/bookings/mine via le proxy", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } })
  }) as typeof fetch // signature simplifiée suffisante pour le test
  try {
    assert.deepEqual(await api.getDriverMyBookings(), [])
  } finally {
    globalThis.fetch = original
  }
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "/api/proxy/driver/bookings/mine")
  assert.equal(calls[0].init?.method ?? "GET", "GET")
})
