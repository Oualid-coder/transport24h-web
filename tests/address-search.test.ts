// Recherche d'adresse par l'API (BAN, Géoplateforme IGN) : validation de la réponse, état
// « indisponible », règle « pas de devis sans coordonnées confirmées ».
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  ADDRESS_UNAVAILABLE_MESSAGE,
  addressQuery,
  addressSearchErrorMessage,
  isInvalidQueryError,
  isQuotablePoint,
  isUnconfirmedAddress,
  parseGeocodeResponse,
  selectionAfterEdit,
} from "../lib/address-search"
import { ApiError, searchAddresses } from "../lib/api"

const ok = {
  label: "11 Rue Boyer-Barret, 75014 Paris",
  lat: 48.832777,
  lng: 2.318053,
  postcode: "75014",
  city: "Paris",
  type: "housenumber",
  score: null,
}

test("texte envoyé : espaces regroupées, 3 à 200 caractères, sinon aucune requête", () => {
  assert.equal(addressQuery("  11   rue  X "), "11 rue X")
  assert.equal(addressQuery("ab"), null)
  assert.equal(addressQuery("   "), null)
  assert.equal(addressQuery("é".repeat(200)), "é".repeat(200))
  assert.equal(addressQuery("a".repeat(201)), null)
})

test("réponse de l'API : contrat validé, libellé → address", () => {
  assert.deepEqual(parseGeocodeResponse({ results: [ok] }), [
    { lat: 48.832777, lng: 2.318053, address: ok.label, postcode: "75014", city: "Paris", type: "housenumber", score: null },
  ])
  assert.deepEqual(parseGeocodeResponse({ results: [] }), [])
  assert.equal(parseGeocodeResponse({ results: [{ ...ok, score: 0.97 }] })?.[0]?.score, 0.97)
})

test("réponse de l'API hors contrat → null (traité comme une indisponibilité)", () => {
  for (const bad of [
    null,
    "<html>",
    [],
    {},
    { results: [{ ...ok, lat: "48.8" }] },
    { results: [{ ...ok, lat: 91 }] },
    { results: [{ ...ok, lng: -181 }] },
    { results: [{ ...ok, label: "" }] },
    { results: [{ ...ok, score: 2 }] },
    { results: [{ lat: 48.8, lng: 2.3 }] },
    { results: Array.from({ length: 21 }, () => ok) },
  ]) {
    assert.equal(parseGeocodeResponse(bad), null, JSON.stringify(bad))
  }
})

test("réponse de l'API : point 0,0 écarté", () => {
  assert.deepEqual(parseGeocodeResponse({ results: [{ ...ok, lat: 0, lng: 0 }] }), [])
})

test("état indisponible : message clair, 429 → délai, 422 n'est pas une panne", () => {
  assert.equal(addressSearchErrorMessage(new ApiError(503, "x")), ADDRESS_UNAVAILABLE_MESSAGE)
  assert.equal(addressSearchErrorMessage(new TypeError("Failed to fetch")), ADDRESS_UNAVAILABLE_MESSAGE)
  assert.equal(addressSearchErrorMessage(new ApiError(429, "x", 12)), "Trop de demandes en ce moment, réessayez dans 12 s.")
  assert.equal(isInvalidQueryError(new ApiError(422, "adresse invalide")), true)
  assert.equal(isInvalidQueryError(new ApiError(503, "x")), false)
})

test("devis : jamais sans coordonnées retenues, ni avec d'anciennes coordonnées après modification", () => {
  const chosen = { lat: 48.832777, lng: 2.318053, address: ok.label }
  assert.equal(isQuotablePoint(chosen), true)
  assert.equal(isQuotablePoint(null), false)
  assert.equal(isQuotablePoint({ ...chosen, lat: 0, lng: 0 }), false)
  assert.equal(isQuotablePoint({ ...chosen, lat: Number.NaN }), false)
  assert.equal(isQuotablePoint({ ...chosen, lng: 200 }), false)
  assert.equal(isQuotablePoint({ ...chosen, address: " " }), false)

  // Texte identique : choix gardé ; une lettre changée : plus rien
  assert.equal(selectionAfterEdit(chosen, ok.label), chosen)
  const after = selectionAfterEdit(chosen, ok.label.replace("11", "13"))
  assert.equal(after, null)
  assert.equal(isQuotablePoint(after), false)
  assert.equal(selectionAfterEdit(null, "11 rue"), null)
})

test("envoi refusé si un texte est tapé sans adresse retenue correspondante", () => {
  const chosen = { lat: 48.8, lng: 2.3, address: "1 Rue A, 75001 Paris" }
  assert.equal(isUnconfirmedAddress("", null), false)
  assert.equal(isUnconfirmedAddress("  ", null), false)
  assert.equal(isUnconfirmedAddress("1 rue A", null), true)
  assert.equal(isUnconfirmedAddress(chosen.address, chosen), false)
  assert.equal(isUnconfirmedAddress(chosen.address + " bis", chosen), true)
})

// ── Appels à l'API (fetch simulé) ─────────────────────────────────────────────

type Call = { url: string; init: RequestInit }

async function withFetch<T>(impl: (url: string, init: RequestInit) => Promise<Response>, fn: (calls: Call[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  const calls: Call[] = []
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, init })
    return impl(url, init)
  }) as typeof fetch
  try {
    return await fn(calls)
  } finally {
    globalThis.fetch = original
  }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } }))

test("autocomplétion : POST /geocode/completion, texte dans le corps, jamais dans l'URL", async () => {
  await withFetch(() => json(200, { results: [ok] }), async (calls) => {
    const res = await searchAddresses("  11 rue Boyer-Barret  ")
    assert.equal(res.length, 1)
    assert.equal(res[0]?.address, ok.label)
    assert.equal(calls.length, 1)
    assert.ok(calls[0]!.url.endsWith("/geocode/completion"))
    assert.ok(!calls[0]!.url.includes("Boyer"))
    assert.equal(calls[0]!.init.method, "POST")
    assert.equal(calls[0]!.init.credentials, "omit")
    assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { text: "11 rue Boyer-Barret" })
  })
})

test("autocomplétion : texte trop court → aucune requête", async () => {
  await withFetch(() => json(200, { results: [ok] }), async (calls) => {
    assert.deepEqual(await searchAddresses("ab"), [])
    assert.equal(calls.length, 0)
  })
})

test("indisponibilité : 503, 500, réseau, réponse hors contrat → ApiError 503 ; 429 et 422 gardés", async () => {
  const cases: Array<[() => Promise<Response>, number, number | null]> = [
    [() => json(503, { error: "Le service de recherche d'adresses est momentanément indisponible." }, { "Retry-After": "5" }), 503, 5],
    [() => json(500, {}), 503, null],
    [() => json(502, {}), 503, null],
    [() => Promise.reject(new TypeError("Failed to fetch")), 503, null],
    [() => json(200, { results: [{ lat: "x" }] }), 503, null],
    [() => Promise.resolve(new Response("<html>", { status: 200 })), 503, null],
    [() => json(429, { error: "trop de requêtes" }, { "Retry-After": "30" }), 429, 30],
    [() => json(422, { error: "adresse invalide" }), 422, null],
  ]
  for (const [impl, status, retryAfter] of cases) {
    await withFetch(impl, async () => {
      for (const call of [searchAddresses]) {
        await assert.rejects(call("11 rue Boyer-Barret"), (err: unknown) => {
          assert.ok(err instanceof ApiError)
          assert.equal(err.status, status)
          assert.equal(err.retryAfter, retryAfter)
          return true
        })
      }
    })
  }
})

test("requête annulée (frappe suivante) : AbortError propagée, pas d'état indisponible", async () => {
  await withFetch(() => Promise.reject(new DOMException("aborted", "AbortError")), async () => {
    await assert.rejects(searchAddresses("11 rue Boyer-Barret"), (err: unknown) => err instanceof DOMException && err.name === "AbortError")
  })
})

// Aucune sélection automatique : le web n'appelle plus /geocode/search, et aucune fonction ne
// choisit une adresse à la place de l'internaute (les deux faux devis de la relecture).
test("aucun choix automatique : ni géocodage au départ du champ, ni sélection d'office", async () => {
  const { readFileSync } = await import("node:fs")
  const api = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8")
  const input = readFileSync(new URL("../components/AddressInput.tsx", import.meta.url), "utf8")
  assert.ok(!api.includes("/geocode/search") && !api.includes('"search"'))
  assert.ok(!input.includes("geocodeAddress"))
  // select() n'est appelé que par un choix (clic ou Entrée sur une suggestion)
  assert.equal(input.match(/\bselect\(/g)?.length, 2)
})
