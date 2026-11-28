// Filtre de statut de /admin/partners (API : GET /admin/partners?status=, sujet 49)
import { test } from "node:test"
import assert from "node:assert/strict"
import { getAdminPartners } from "../lib/api"
import { partnersForStatus } from "../lib/partner-status-filter"
import type { PartnerApplication, PartnerStatus } from "../lib/types"

function app(id: string, status: PartnerStatus): PartnerApplication {
  return {
    id,
    first_name: "Jean",
    last_name: "Dupont",
    email: `${id}@example.com`,
    phone: "0612345678",
    siret: "12345678901234",
    truck_type: "12m3",
    status,
    created_at: "2026-11-27T10:00:00Z",
    documents_count: 0,
    kbis_uploaded: false,
    licence_mere_uploaded: false,
    rcp_uploaded: false,
    urssaf_uploaded: false,
  } as PartnerApplication
}

const mixed = [app("p1", "pending"), app("a1", "approved"), app("p2", "pending"), app("r1", "rejected")]

test("onglet d'un statut : seulement ce statut, ordre de l'API conservé", () => {
  assert.deepEqual(partnersForStatus(mixed, "pending").map((p) => p.id), ["p1", "p2"])
  assert.deepEqual(partnersForStatus(mixed, "approved").map((p) => p.id), ["a1"])
  assert.deepEqual(partnersForStatus(mixed, "rejected").map((p) => p.id), ["r1"])
})

test("onglet Toutes : tout, sans modifier la liste reçue", () => {
  const out = partnersForStatus(mixed)
  assert.deepEqual(out.map((p) => p.id), ["p1", "a1", "p2", "r1"])
  assert.notEqual(out, mixed)
  assert.deepEqual(partnersForStatus([], "pending"), [])
})

test("carte approuvée dans l'onglet En attente (avant relecture) : retirée", () => {
  const afterApprove = mixed.map((p) => (p.id === "p1" ? { ...p, status: "approved" as const } : p))
  assert.deepEqual(partnersForStatus(afterApprove, "pending").map((p) => p.id), ["p2"])
})

test("getAdminPartners : statut envoyé dans ?status=, aucun paramètre pour Toutes", async () => {
  const urls: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string) => {
    urls.push(url)
    return Response.json([])
  }) as typeof fetch // signature simplifiée suffisante pour le test
  try {
    for (const s of ["pending", "approved", "rejected"] as const) await getAdminPartners(s)
    await getAdminPartners()
  } finally {
    globalThis.fetch = original
  }
  assert.deepEqual(urls, [
    "/api/proxy/admin/partners?status=pending",
    "/api/proxy/admin/partners?status=approved",
    "/api/proxy/admin/partners?status=rejected",
    "/api/proxy/admin/partners",
  ])
})
