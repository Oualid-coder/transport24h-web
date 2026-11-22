// Carte admin : nom du chauffeur affecté (driver_first_name / driver_last_name de la liste
// admin) et cache de la liste après PUT /admin/bookings/{id}/assign. Lancer : npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { driverDisplayName, refreshAfterAssign } from "../lib/driver-assignment"
import type { PaginatedBookings } from "../lib/types"

test("driverDisplayName : prénom et nom du chauffeur", () => {
  assert.equal(driverDisplayName({ driver_first_name: "Karim", driver_last_name: "Benali" }), "Karim Benali")
  assert.equal(driverDisplayName({ driver_first_name: " Karim ", driver_last_name: "" }), "Karim")
  assert.equal(driverDisplayName({ driver_first_name: null, driver_last_name: "Benali" }), "Benali")
})

test("driverDisplayName : sans chauffeur (null) ou API antérieure (champs absents) → null", () => {
  assert.equal(driverDisplayName({ driver_first_name: null, driver_last_name: null }), null)
  assert.equal(driverDisplayName({}), null)
  assert.equal(driverDisplayName({ driver_first_name: "  ", driver_last_name: "" }), null)
})

// Liste en cache telle que GET /admin/bookings la renvoie (seuls les champs utiles au test).
function seededClient() {
  const qc = new QueryClient()
  const key = ["admin-bookings", "all", "all", 1]
  const list = {
    total: 1,
    bookings: [{ id: "b1", status: "confirmed", client_first_name: "Alice", client_last_name: "Martin" }],
  } as unknown as PaginatedBookings
  qc.setQueryData(key, list)
  return { qc, key, list }
}

test("refreshAfterAssign invalide la liste sans y écrire la réponse partielle", async () => {
  const { qc, key, list } = seededClient()
  await refreshAfterAssign(qc, key)
  assert.equal(qc.getQueryState(key)?.isInvalidated, true)
  // Le nom du client reste en cache jusqu'au rechargement (rien n'est écrasé).
  assert.equal(qc.getQueryData(key), list)
})

test("refreshAfterAssign recharge la liste active : client conservé, chauffeur affiché", async () => {
  const qc = new QueryClient()
  const key = ["admin-bookings", "all", "all", 1]
  let calls = 0
  const fresh = {
    total: 1,
    bookings: [{
      id: "b1", status: "assigned", client_first_name: "Alice", client_last_name: "Martin",
      driver_first_name: "Karim", driver_last_name: "Benali",
    }],
  }
  const queryFn = async () => { calls++; return fresh }
  // Observateur actif, comme la liste affichée par BookingList.
  const obs = new QueryObserver(qc, { queryKey: key, queryFn })
  const unsubscribe = obs.subscribe(() => {})
  try {
    await qc.fetchQuery({ queryKey: key, queryFn })
    const before = calls
    await refreshAfterAssign(qc, key)
    assert.ok(calls > before, "la liste active doit être rechargée")
    const data = qc.getQueryData<typeof fresh>(key)
    assert.equal(data?.bookings[0].client_first_name, "Alice")
    assert.equal(driverDisplayName(data!.bookings[0]), "Karim Benali")
  } finally {
    unsubscribe()
    qc.clear()
  }
})

test("AssignDriverModal n'écrit plus la réponse de PUT …/assign dans le cache", () => {
  const src = readFileSync(new URL("../components/admin/AssignDriverModal.tsx", import.meta.url), "utf8")
  assert.doesNotMatch(src, /setQueryData/)
  assert.match(src, /refreshAfterAssign\(queryClient, queryKey\)/)
})

test("BookingCard affiche le nom du chauffeur via driverDisplayName", () => {
  const src = readFileSync(new URL("../components/admin/BookingCard.tsx", import.meta.url), "utf8")
  assert.match(src, /driverDisplayName\(booking\)/)
})
