// Renouvellement de session (audit M5) : cookies du login, /api/auth/refresh, /api/auth/logout,
// nouvel essai unique sur 401 dans lib/api.ts, page /session, proxy.ts.
import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { POST as loginPost } from "../app/api/auth/login/route"
import { POST as refreshPost } from "../app/api/auth/refresh/route"
import { POST as logoutPost } from "../app/api/auth/logout/route"
import { getMyBookings, isReplayableBody, resumeSession, uploadBookingPhoto, ApiError } from "../lib/api"
import { proxy } from "../proxy"

type Call = { url: string; init: RequestInit }
type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

const original = globalThis.fetch
afterEach(() => {
  globalThis.fetch = original
  Reflect.deleteProperty(globalThis, "window")
})

function mockFetch(handler: Handler): Call[] {
  const calls: Call[] = []
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    if (String(url).includes("api.transport24h.fr")) throw new Error("appel de production interdit en test")
    calls.push({ url: String(url), init })
    return handler(String(url), init)
  }) as typeof fetch // signature simplifiée suffisante pour le test
  return calls
}

// Faux JWT (non signé, sans valeur) : seul le payload { role } est lu par le web
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url")
const jwt = (role: string) => `${b64({ alg: "none" })}.${b64({ role, sub: "u1" })}.sig`

const SITE = "http://transport24h.test"
const req = (path: string, init: { method?: string; headers?: Record<string, string>; body?: BodyInit } = {}) =>
  new NextRequest(`${SITE}${path}`, { method: "POST", ...init, headers: { host: "transport24h.test", ...init.headers } })

const setCookies = (res: Response) => res.headers.getSetCookie()
const cookieLine = (res: Response, name: string, path: string) =>
  setCookies(res).find((l) => l.startsWith(`${name}=`) && new RegExp(`Path=${path}(;|$)`, "i").test(l))

// Set-Cookie réel de l'API (handler/auth.go setRefreshCookie)
const GO_REFRESH = "refresh_token=RT1; Path=/auth; Max-Age=604800; HttpOnly; Secure; SameSite=Strict"

// ── Login : cookies ──────────────────────────────────────────────────────────

test("login : refresh reposé en Path=/api/auth (HttpOnly, Strict, 7 j), plus de cookie en Path=/auth", async () => {
  mockFetch(() => {
    const h = new Headers({ "content-type": "application/json" })
    h.append("set-cookie", GO_REFRESH)
    return new Response(JSON.stringify({ access_token: jwt("client"), expires_in: 900 }), { status: 200, headers: h })
  })
  const res = await loginPost(req("/api/auth/login", { headers: { origin: SITE, "content-type": "application/json" }, body: '{"email":"a@b.c","password":"x"}' }))
  assert.equal(res.status, 200)
  const refresh = cookieLine(res, "refresh_token", "/api/auth")
  assert.ok(refresh, setCookies(res).join("\n"))
  assert.match(refresh, /^refresh_token=RT1;/)
  assert.match(refresh, /HttpOnly/i)
  assert.match(refresh, /SameSite=strict/i)
  assert.match(refresh, /Max-Age=604800/i)
  assert.equal(cookieLine(res, "refresh_token", "/auth"), undefined)
  const access = cookieLine(res, "access_token", "/")
  assert.ok(access)
  assert.match(access, /HttpOnly/i)
  assert.match(access, /SameSite=lax/i)
  assert.match(access, /Max-Age=900/i)
  assert.match(cookieLine(res, "user_role", "/") ?? "", /^user_role=client;/)
})

test("login en production : cookies Secure", async () => {
  const env = process.env as Record<string, string | undefined>
  const prev = env.NODE_ENV
  env.NODE_ENV = "production"
  try {
    mockFetch(() => {
      const h = new Headers()
      h.append("set-cookie", GO_REFRESH)
      return new Response(JSON.stringify({ access_token: jwt("admin"), expires_in: 900 }), { status: 200, headers: h })
    })
    const res = await loginPost(req("/api/auth/login", { headers: { "content-type": "application/json" }, body: '{"email":"a@b.c","password":"x"}' }))
    for (const [name, path] of [["refresh_token", "/api/auth"], ["access_token", "/"], ["user_role", "/"]]) {
      assert.match(cookieLine(res, name, path) ?? "", /Secure/i, name)
    }
  } finally {
    env.NODE_ENV = prev
  }
})

// ── /api/auth/refresh ────────────────────────────────────────────────────────

test("refresh : cookie relayé à l'API (en-tête Cookie, IP), access_token et user_role reposés", async () => {
  const calls = mockFetch(() => Response.json({ access_token: jwt("driver"), expires_in: 900 }))
  const res = await refreshPost(req("/api/auth/refresh", { headers: { origin: SITE, cookie: "refresh_token=RT1", "x-real-ip": "203.0.113.7" } }))
  assert.equal(res.status, 200)
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /\/auth\/refresh$/)
  assert.equal(calls[0].init.method, "POST")
  const h = new Headers(calls[0].init.headers)
  assert.equal(h.get("cookie"), "refresh_token=RT1")
  assert.equal(h.get("x-real-ip"), "203.0.113.7")
  assert.equal(calls[0].init.body, undefined)
  assert.match(cookieLine(res, "access_token", "/") ?? "", new RegExp(`^access_token=${jwt("driver").replace(/\./g, "\\.")};.*Max-Age=900`, "i"))
  assert.match(cookieLine(res, "user_role", "/") ?? "", /^user_role=driver;/)
  // L'API ne fait pas tourner le refresh : cookie refresh inchangé
  assert.equal(setCookies(res).some((l) => l.startsWith("refresh_token=")), false)
})

test("refresh : rotation par l'API → nouveau refresh reposé en Path=/api/auth", async () => {
  mockFetch(() => {
    const h = new Headers()
    h.append("set-cookie", "refresh_token=RT2; Path=/auth; Max-Age=600; HttpOnly; SameSite=Strict")
    return new Response(JSON.stringify({ access_token: jwt("client"), expires_in: 900 }), { status: 200, headers: h })
  })
  const res = await refreshPost(req("/api/auth/refresh", { headers: { cookie: "refresh_token=RT1" } }))
  assert.match(cookieLine(res, "refresh_token", "/api/auth") ?? "", /^refresh_token=RT2;.*Max-Age=600/i)
})

test("refresh : cookie absent → 401 sans appel à l'API, cookies effacés (y compris Path=/auth)", async () => {
  const calls = mockFetch(() => Response.json({}))
  const res = await refreshPost(req("/api/auth/refresh", { headers: { origin: SITE } }))
  assert.equal(res.status, 401)
  assert.equal(calls.length, 0)
  assert.match(cookieLine(res, "access_token", "/") ?? "", /^access_token=;/)
  assert.match(cookieLine(res, "refresh_token", "/api/auth") ?? "", /^refresh_token=;/)
  assert.match(cookieLine(res, "refresh_token", "/auth") ?? "", /^refresh_token=;.*Max-Age=0/i)
})

test("refresh : API 401 (expiré/révoqué) ou 403 (désactivé) → même statut, cookies effacés", async () => {
  for (const status of [401, 403]) {
    mockFetch(() => Response.json({ error: "refresh token invalide ou expiré" }, { status }))
    const res = await refreshPost(req("/api/auth/refresh", { headers: { cookie: "refresh_token=RT1" } }))
    assert.equal(res.status, status)
    assert.match(cookieLine(res, "access_token", "/") ?? "", /^access_token=;/)
    assert.match(cookieLine(res, "refresh_token", "/api/auth") ?? "", /^refresh_token=;/)
  }
})

test("refresh : API 500/429 → statut relayé, cookies gardés ; réseau → 502", async () => {
  mockFetch(() => Response.json({ error: "x" }, { status: 429, headers: { "retry-after": "30" } }))
  const limited = await refreshPost(req("/api/auth/refresh", { headers: { cookie: "refresh_token=RT1" } }))
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get("retry-after"), "30")
  assert.equal(setCookies(limited).length, 0)
  mockFetch(() => { throw new TypeError("fetch failed") })
  const down = await refreshPost(req("/api/auth/refresh", { headers: { cookie: "refresh_token=RT1" } }))
  assert.equal(down.status, 502)
  assert.equal(setCookies(down).length, 0)
})

test("refresh : autre origine → 403 sans appel à l'API", async () => {
  const calls = mockFetch(() => Response.json({}))
  const res = await refreshPost(req("/api/auth/refresh", { headers: { origin: "https://evil.example", cookie: "refresh_token=RT1" } }))
  assert.equal(res.status, 403)
  assert.equal(calls.length, 0)
})

// ── /api/auth/logout ─────────────────────────────────────────────────────────

test("logout : révoque le refresh à l'API puis efface tous les cookies (Path=/api/auth et ancien Path=/auth)", async () => {
  const calls = mockFetch(() => new Response(null, { status: 204 }))
  const res = await logoutPost(req("/api/auth/logout", { headers: { origin: SITE, cookie: "refresh_token=RT1; access_token=a", "x-real-ip": "203.0.113.7" } }))
  assert.equal(res.status, 200)
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /\/auth\/logout$/)
  assert.equal(calls[0].init.method, "POST")
  assert.equal(new Headers(calls[0].init.headers).get("cookie"), "refresh_token=RT1")
  assert.equal(new Headers(calls[0].init.headers).get("x-real-ip"), "203.0.113.7")
  assert.match(cookieLine(res, "access_token", "/") ?? "", /^access_token=;/)
  assert.match(cookieLine(res, "user_role", "/") ?? "", /^user_role=;/)
  assert.match(cookieLine(res, "refresh_token", "/api/auth") ?? "", /^refresh_token=;/)
  assert.match(cookieLine(res, "refresh_token", "/auth") ?? "", /^refresh_token=;.*Max-Age=0/i)
})

test("logout : API en erreur → cookies effacés quand même ; sans refresh → aucun appel", async () => {
  mockFetch(() => { throw new TypeError("fetch failed") })
  const down = await logoutPost(req("/api/auth/logout", { headers: { cookie: "refresh_token=RT1" } }))
  assert.equal(down.status, 200)
  assert.match(cookieLine(down, "access_token", "/") ?? "", /^access_token=;/)
  const calls = mockFetch(() => new Response(null, { status: 204 }))
  const none = await logoutPost(req("/api/auth/logout", { headers: { origin: SITE } }))
  assert.equal(none.status, 200)
  assert.equal(calls.length, 0)
  assert.match(cookieLine(none, "refresh_token", "/auth") ?? "", /^refresh_token=;/)
})

// ── Client : nouvel essai unique sur 401 ─────────────────────────────────────

function fakeWindow() {
  const loc = { href: "", pathname: "/booking/new", search: "?q=1" }
  Reflect.set(globalThis, "window", { location: loc })
  return loc
}

test("apiFetch : 401 → refresh → requête rejouée une fois → succès", async () => {
  let proxyHits = 0
  const calls = mockFetch((url) => {
    if (url === "/api/auth/refresh") return Response.json({ ok: true })
    proxyHits++
    return proxyHits === 1 ? Response.json({ error: "x" }, { status: 401 }) : Response.json([{ id: "b1" }])
  })
  const loc = fakeWindow()
  const result = await getMyBookings()
  assert.deepEqual(result, [{ id: "b1" }])
  assert.deepEqual(calls.map((c) => c.url), ["/api/proxy/bookings/me", "/api/auth/refresh", "/api/proxy/bookings/me"])
  assert.equal(calls[1].init.method, "POST")
  assert.equal(loc.href, "")
})

test("apiFetch : refresh refusé → ApiError 401 + connexion, aucun rejeu", async () => {
  const calls = mockFetch((url) =>
    url === "/api/auth/refresh" ? Response.json({ error: "x" }, { status: 401 }) : Response.json({ error: "x" }, { status: 401 }),
  )
  const loc = fakeWindow()
  await assert.rejects(getMyBookings(), (e: unknown) => e instanceof ApiError && e.status === 401)
  assert.deepEqual(calls.map((c) => c.url), ["/api/proxy/bookings/me", "/api/auth/refresh"])
  assert.equal(loc.href, `/login?redirect=${encodeURIComponent("/booking/new?q=1")}`)
})

test("apiFetch : 401 encore après refresh réussi → connexion, pas de second refresh (pas de boucle)", async () => {
  const calls = mockFetch((url) => (url === "/api/auth/refresh" ? Response.json({ ok: true }) : Response.json({}, { status: 401 })))
  const loc = fakeWindow()
  await assert.rejects(getMyBookings(), (e: unknown) => e instanceof ApiError && e.status === 401)
  assert.deepEqual(calls.map((c) => c.url), ["/api/proxy/bookings/me", "/api/auth/refresh", "/api/proxy/bookings/me"])
  assert.match(loc.href, /^\/login\?redirect=/)
})

test("apiFetch : requêtes parallèles en 401 → un seul refresh, toutes rejouées", async () => {
  let refreshed = false
  let releaseRefresh: () => void = () => {}
  const refreshGate = new Promise<void>((r) => { releaseRefresh = r })
  const calls = mockFetch(async (url) => {
    if (url === "/api/auth/refresh") {
      await refreshGate
      refreshed = true
      return Response.json({ ok: true })
    }
    return refreshed ? Response.json([]) : Response.json({}, { status: 401 })
  })
  fakeWindow()
  const all = Promise.all([getMyBookings(), getMyBookings(), getMyBookings()])
  await new Promise((r) => setTimeout(r, 10)) // les trois 401 sont reçus pendant que le refresh est en vol
  releaseRefresh()
  assert.deepEqual(await all, [[], [], []])
  assert.equal(calls.filter((c) => c.url === "/api/auth/refresh").length, 1)
  assert.equal(calls.filter((c) => c.url === "/api/proxy/bookings/me").length, 6)
})

test("upload photo : 401 → refresh → même fichier renvoyé (Blob rejouable)", async () => {
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "p.jpg", { type: "image/jpeg" })
  let hits = 0
  const calls = mockFetch((url) => {
    if (url === "/api/auth/refresh") return Response.json({ ok: true })
    hits++
    return hits === 1 ? Response.json({}, { status: 401 }) : Response.json({ id: "p" }, { status: 201 })
  })
  fakeWindow()
  await uploadBookingPhoto("b1", "before", file)
  const uploads = calls.filter((c) => c.url.startsWith("/api/proxy/"))
  assert.equal(uploads.length, 2)
  assert.equal(uploads[1].init.body, file)
  assert.equal(new Headers(uploads[1].init.headers).get("content-type"), "image/jpeg")
})

test("corps rejouables : chaîne, Blob, ArrayBuffer, FormData oui ; ReadableStream non", () => {
  assert.equal(isReplayableBody(undefined), true)
  assert.equal(isReplayableBody("{}"), true)
  assert.equal(isReplayableBody(new Blob(["x"])), true)
  assert.equal(isReplayableBody(new ArrayBuffer(2)), true)
  assert.equal(isReplayableBody(new FormData()), true)
  assert.equal(isReplayableBody(new ReadableStream()), false)
})

// ── Page /session et proxy.ts ────────────────────────────────────────────────

test("resumeSession : succès → page demandée ; échec → connexion ; redirection externe refusée", async () => {
  mockFetch(() => Response.json({ ok: true }))
  assert.equal(await resumeSession("/booking/new?x=1"), "/booking/new?x=1")
  assert.equal(await resumeSession("//evil.example"), "/dashboard")
  mockFetch(() => Response.json({}, { status: 401 }))
  assert.equal(await resumeSession("/admin/dashboard"), `/login?redirect=${encodeURIComponent("/admin/dashboard")}`)
})

test("resumeSession : renouvellement récent déjà tenté → connexion directe, aucun appel (pas de boucle)", async () => {
  const calls = mockFetch(() => Response.json({ ok: true }))
  assert.equal(await resumeSession("/dashboard", true), `/login?redirect=${encodeURIComponent("/dashboard")}`)
  assert.equal(calls.length, 0)
})

test("proxy.ts : page protégée sans access_token → /session (pas /login) ; avec access_token → laisse passer", () => {
  const noToken = proxy(new NextRequest(`${SITE}/booking/new?q=1`))
  assert.equal(noToken.status, 307)
  const loc = new URL(noToken.headers.get("location") ?? "")
  assert.equal(loc.pathname, "/session")
  assert.equal(loc.searchParams.get("redirect"), "/booking/new?q=1")
  const withToken = proxy(new NextRequest(`${SITE}/dashboard`, { headers: { cookie: "access_token=a" } }))
  assert.equal(withToken.headers.get("location"), null)
  const publicPage = proxy(new NextRequest(`${SITE}/session?redirect=/dashboard`))
  assert.equal(publicPage.headers.get("location"), null)
})
