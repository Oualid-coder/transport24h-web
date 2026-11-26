// Tableaux de bord : une erreur de l'API ne s'affiche jamais comme une liste vide. Lancer : npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { ApiError, resumeSession } from "../lib/api"
import { ROLE_FORBIDDEN_MESSAGE } from "../lib/error-message"
import { safeRedirectPath } from "../lib/safe-redirect"
import {
  FORBIDDEN_MESSAGE,
  NOT_FOUND_MESSAGE,
  UNAVAILABLE_MESSAGE,
  canRetryLoad,
  loadErrorMessage,
  loadServerList,
  sessionRedirectUrl,
} from "../lib/list-load"

const FALLBACK = "Impossible de charger vos courses."
const URL_ME = "https://api.test/bookings/me"

type Call = { url: string; init?: RequestInit }

function fakeFetch(respond: () => Response | Promise<Response>, calls: Call[] = []): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return respond()
  }) as typeof fetch // signature simplifiée suffisante pour le test
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })

const load = (respond: () => Response | Promise<Response>, calls?: Call[], timeoutMs?: number) =>
  loadServerList(URL_ME, { Authorization: "Bearer t" }, FALLBACK, fakeFetch(respond, calls), timeoutMs)

test("loadServerList : 200 [] → liste vide (état vide normal)", async () => {
  assert.deepEqual(await load(() => json([])), { kind: "ok", items: [] })
})

test("loadServerList : 200 avec des courses → liste, en-têtes et no-store transmis", async () => {
  const calls: Call[] = []
  const r = await load(() => json([{ id: "a", status: "confirmed" }]), calls)
  assert.deepEqual(r, { kind: "ok", items: [{ id: "a", status: "confirmed" }] })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, URL_ME)
  assert.deepEqual(calls[0].init?.headers, { Authorization: "Bearer t" })
  assert.equal(calls[0].init?.cache, "no-store")
  assert.ok(calls[0].init?.signal instanceof AbortSignal)
})

test("loadServerList : 401 → session (jamais une liste vide)", async () => {
  assert.deepEqual(await load(() => json({ error: "token invalide" }, 401)), { kind: "session" })
  assert.deepEqual(await load(() => new Response(null, { status: 401 })), { kind: "session" })
})

test("loadServerList : 503 → état d'erreur réessayable, Retry-After affiché", async () => {
  assert.deepEqual(await load(() => json({ error: "base indisponible" }, 503)), {
    kind: "error",
    message: UNAVAILABLE_MESSAGE,
    retryable: true,
  })
  assert.deepEqual(await load(() => json({ error: "base indisponible" }, 503, { "Retry-After": "30" })), {
    kind: "error",
    message: "Service momentanément indisponible, réessayez dans 30 s.",
    retryable: true,
  })
})

test("loadServerList : 502 et 504 (gateway) → indisponible", async () => {
  for (const status of [502, 504]) {
    const r = await load(() => new Response("<html>Bad Gateway</html>", { status }))
    assert.deepEqual(r, { kind: "error", message: UNAVAILABLE_MESSAGE, retryable: true }, String(status))
  }
})

test("loadServerList : erreur réseau → indisponible", async () => {
  const r = await load(() => {
    throw new TypeError("fetch failed")
  })
  assert.deepEqual(r, { kind: "error", message: UNAVAILABLE_MESSAGE, retryable: true })
})

test("loadServerList : délai dépassé → indisponible (requête annulée)", { timeout: 2000 }, async () => {
  let aborted = false
  const slow: typeof fetch = ((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true
        reject(init.signal?.reason)
      })
    })) as typeof fetch // signature simplifiée suffisante pour le test
  // Le minuteur d'AbortSignal.timeout ne retient pas la boucle d'événements : on la garde ouverte 1 s
  const keepAlive = setTimeout(() => {}, 1000)
  const r = await loadServerList(URL_ME, {}, FALLBACK, slow, 20).finally(() => clearTimeout(keepAlive))
  assert.ok(aborted)
  assert.deepEqual(r, { kind: "error", message: UNAVAILABLE_MESSAGE, retryable: true })
})

test("loadServerList : 403 → message adapté, sans « Réessayer »", async () => {
  assert.deepEqual(await load(() => json({ error: "compte désactivé" }, 403)), {
    kind: "error",
    message: "Compte désactivé",
    retryable: false,
  })
  assert.deepEqual(await load(() => json({ error: 'rôle insuffisant : "driver"' }, 403)), {
    kind: "error",
    message: ROLE_FORBIDDEN_MESSAGE,
    retryable: false,
  })
  assert.deepEqual(await load(() => new Response(null, { status: 403 })), {
    kind: "error",
    message: FORBIDDEN_MESSAGE,
    retryable: false,
  })
})

test("loadServerList : 404 → liste introuvable ; 500 → repli de l'écran ; 429 → délai", async () => {
  assert.deepEqual(await load(() => json({ error: "not found" }, 404)), {
    kind: "error",
    message: NOT_FOUND_MESSAGE,
    retryable: true,
  })
  assert.deepEqual(await load(() => json({ error: "pq: boom" }, 500)), { kind: "error", message: FALLBACK, retryable: true })
  assert.deepEqual(await load(() => json({ error: "trop de requêtes" }, 429, { "Retry-After": "12" })), {
    kind: "error",
    message: "Trop de demandes en ce moment, réessayez dans 12 s.",
    retryable: true,
  })
})

test("loadServerList : 200 illisible ou hors contrat → erreur, pas liste vide", async () => {
  for (const respond of [
    () => new Response("pas du json", { status: 200 }),
    () => json({ bookings: [] }),
    () => json(null),
  ]) {
    assert.deepEqual(await load(respond), { kind: "error", message: UNAVAILABLE_MESSAGE, retryable: true })
  }
})

test("loadErrorMessage / canRetryLoad : erreurs côté navigateur (React Query)", () => {
  const F = "Impossible de charger vos missions."
  assert.equal(loadErrorMessage(new TypeError("Failed to fetch"), F), UNAVAILABLE_MESSAGE)
  assert.equal(loadErrorMessage(new ApiError(503, "Service momentanément indisponible, réessayez."), F), UNAVAILABLE_MESSAGE)
  assert.equal(loadErrorMessage(new ApiError(502, "Backend inaccessible"), F), UNAVAILABLE_MESSAGE)
  assert.equal(loadErrorMessage(new ApiError(503, "x", 5), F), "Service momentanément indisponible, réessayez dans 5 s.")
  assert.equal(loadErrorMessage(new ApiError(404, "not found"), F), NOT_FOUND_MESSAGE)
  assert.equal(loadErrorMessage(new ApiError(400, "id invalide"), F), F)
  assert.equal(canRetryLoad(new ApiError(403, "x")), false)
  assert.equal(canRetryLoad(new ApiError(503, "x")), true)
  assert.equal(canRetryLoad(new TypeError("x")), true)
})

test("sessionRedirectUrl : paramètre redirect de proxy.ts, validé contre la redirection ouverte", () => {
  assert.equal(sessionRedirectUrl("/dashboard"), "/session?redirect=%2Fdashboard")
  assert.equal(sessionRedirectUrl("/driver/dashboard?x=1"), "/session?redirect=%2Fdriver%2Fdashboard%3Fx%3D1")
  for (const bad of ["//evil.example", "https://evil.example", "/\\evil.example", "/..//evil.example"]) {
    assert.equal(sessionRedirectUrl(bad), "/session", bad)
  }
  // Même nom de paramètre que proxy.ts et app/session/page.tsx
  assert.ok(readFileSync(new URL("../proxy.ts", import.meta.url), "utf8").includes('searchParams.set("redirect"'))
  assert.ok(readFileSync(new URL("../app/session/page.tsx", import.meta.url), "utf8").includes('searchParams.get("redirect")'))
  const back = new URL(sessionRedirectUrl("/dashboard"), "https://site.test").searchParams.get("redirect")
  assert.equal(safeRedirectPath(back), "/dashboard")
})

test("401 du tableau de bord → /session → refresh réussi → retour à /dashboard ; refusé → /login", async () => {
  const redirect = new URL(sessionRedirectUrl("/dashboard"), "https://site.test").searchParams.get("redirect")
  const original = globalThis.fetch
  try {
    globalThis.fetch = fakeFetch(() => json({ access_token: "x", expires_in: 900 }))
    assert.deepEqual(await resumeSession(redirect, false, () => "user_role=client", () => {}), {
      kind: "navigate",
      to: "/dashboard",
    })
    globalThis.fetch = fakeFetch(() => json({ error: "Session expirée" }, 401))
    assert.deepEqual(await resumeSession(redirect, false, () => "", () => {}), {
      kind: "navigate",
      to: "/login?redirect=%2Fdashboard",
    })
  } finally {
    globalThis.fetch = original
  }
})

const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("dashboard client (serveur) : plus de liste vide sur erreur, 401 → /session", () => {
  const s = src("app/(client)/dashboard/page.tsx")
  assert.ok(!s.includes("return []"))
  assert.ok(!s.includes('redirect("/login'))
  assert.ok(s.includes("loadServerList<Booking>"))
  assert.ok(s.includes('load.kind === "session"') && s.includes("redirect(sessionRedirectUrl(DASHBOARD_PATH))"))
  // L'encadré d'erreur remplace les onglets (et leurs « Aucune course à venir. »)
  assert.ok(s.indexOf('load.kind === "error"') < s.indexOf("<Tabs"))
  assert.ok(s.includes("<RefreshLoadError"))
})

test("listes React Query : erreur testée avant l'état vide", () => {
  const cases: Array<[string, string, string]> = [
    ["app/(driver)/driver/dashboard/page.tsx", "mineError && myBookings.length === 0", "Aucune mission assignée."],
    ["components/admin/AssignDriverModal.tsx", "error && drivers.length === 0", "Aucun chauffeur disponible."],
    ["components/admin/BookingList.tsx", "error && sorted.length === 0", "Aucune réservation."],
  ]
  for (const [path, errorBranch, empty] of cases) {
    const s = src(path)
    assert.ok(s.includes(errorBranch), path)
    assert.ok(s.indexOf(errorBranch) < s.indexOf(empty), path)
    assert.ok(s.includes("<LoadError") && s.includes("loadErrorMessage("), path)
  }
})
