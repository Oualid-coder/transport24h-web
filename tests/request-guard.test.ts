// Proxy web et login (audit F11) : contrôle d'Origin, corps JSON exigé, chemin ré-encodé
import { test } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { isCrossOriginMutation, isJsonContentType, proxyPath } from "../lib/request-guard"
import { GET as proxyGet, POST as proxyPost, DELETE as proxyDelete } from "../app/api/proxy/[...path]/route"
import { POST as loginPost } from "../app/api/auth/login/route"
import { POST as logoutPost } from "../app/api/auth/logout/route"

type Call = { url: string; init: RequestInit }

async function withFetch(response: () => Response, run: () => Promise<Response>) {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    if (String(url).includes("api.transport24h.fr")) throw new Error("appel de production interdit en test")
    calls.push({ url: String(url), init })
    return response()
  }) as typeof fetch // signature simplifiée suffisante pour le test
  try {
    const res = await run()
    return { calls, res }
  } finally {
    globalThis.fetch = original
  }
}

const SITE = "http://transport24h.test"
const req = (path: string, init: { method?: string; headers?: Record<string, string>; body?: BodyInit } = {}) =>
  new NextRequest(`${SITE}${path}`, { ...init, headers: { host: "transport24h.test", ...init.headers } })
const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) })

test("Origin : même hôte, absent ou méthode sûre → accepté", () => {
  assert.equal(isCrossOriginMutation(req("/x", { method: "POST", headers: { origin: SITE } })), false)
  assert.equal(isCrossOriginMutation(req("/x", { method: "POST" })), false)
  assert.equal(isCrossOriginMutation(req("/x", { headers: { origin: "https://evil.example" } })), false)
  assert.equal(
    isCrossOriginMutation(req("/x", { method: "PUT", headers: { origin: "https://www.t.fr", "x-forwarded-host": "www.t.fr" } })),
    false,
  )
})

test("Origin : autre site, sous-domaine, port différent ou null → refusé", () => {
  for (const origin of ["https://evil.example", "https://x.transport24h.test", "http://transport24h.test:8080", "null"]) {
    assert.equal(isCrossOriginMutation(req("/x", { method: "POST", headers: { origin } })), true, origin)
  }
  assert.equal(isCrossOriginMutation(req("/x", { method: "DELETE", headers: { origin: "https://evil.example" } })), true)
})

test("Content-Type JSON exigé", () => {
  assert.equal(isJsonContentType(req("/x", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" } })), true)
  assert.equal(isJsonContentType(req("/x", { method: "POST", headers: { "content-type": "text/plain" } })), false)
  assert.equal(isJsonContentType(req("/x", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" } })), false)
})

test("chemin : segments ré-encodés, . et .. refusés", () => {
  assert.equal(proxyPath(["bookings", "b1", "address"]), "bookings/b1/address")
  assert.equal(proxyPath(["a/b", "c?d#e"]), "a%2Fb/c%3Fd%23e")
  assert.equal(proxyPath(["admin", "..", "x"]), null)
  assert.equal(proxyPath(["."]), null)
  assert.equal(proxyPath([""]), null)
})

test("proxy : POST d'une autre origine → 403 sans appel à l'API", async () => {
  const { calls, res } = await withFetch(
    () => Response.json({}),
    () => proxyPost(req("/api/proxy/bookings", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" }), ctx("bookings")),
  )
  assert.equal(res.status, 403)
  assert.equal(calls.length, 0)
  const del = await withFetch(() => Response.json({}), () => proxyDelete(req("/api/proxy/admin/drivers/1", { method: "DELETE", headers: { origin: "https://evil.example" } }), ctx("admin", "drivers", "1")))
  assert.equal(del.res.status, 403)
  assert.equal(del.calls.length, 0)
})

test("proxy : segment .. → 400 sans appel ; segment avec / ré-encodé", async () => {
  const bad = await withFetch(() => Response.json({}), () => proxyGet(req("/api/proxy/x"), ctx("bookings", "..", "admin")))
  assert.equal(bad.res.status, 400)
  assert.equal(bad.calls.length, 0)
  const ok = await withFetch(() => Response.json({}), () => proxyGet(req("/api/proxy/x?status=done&page=2"), ctx("admin", "refunds", "k/1")))
  assert.equal(ok.res.status, 200)
  assert.match(ok.calls[0].url, /\/admin\/refunds\/k%2F1\?status=done&page=2$/)
})

test("proxy : upload photo binaire image/jpeg de même origine transmis tel quel", async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2])
  const { calls, res } = await withFetch(
    () => Response.json({ id: "p1" }, { status: 201 }),
    () =>
      proxyPost(
        req("/api/proxy/driver/bookings/b1/photos/before", {
          method: "POST",
          headers: { origin: SITE, "content-type": "image/jpeg", cookie: "access_token=jwt" },
          body: bytes,
        }),
        ctx("driver", "bookings", "b1", "photos", "before"),
      ),
  )
  assert.equal(res.status, 201)
  assert.match(calls[0].url, /\/driver\/bookings\/b1\/photos\/before$/)
  assert.equal(new Headers(calls[0].init.headers).get("content-type"), "image/jpeg")
  assert.deepEqual(new Uint8Array(calls[0].init.body as ArrayBuffer), bytes) // corps relayé en ArrayBuffer
})

test("login : text/plain → 415, autre origine → 403, sans appel à l'API", async () => {
  const plain = await withFetch(
    () => Response.json({}),
    () => loginPost(req("/api/auth/login", { method: "POST", headers: { "content-type": "text/plain" }, body: '{"email":"a","password":"b"}' })),
  )
  assert.equal(plain.res.status, 415)
  assert.equal(plain.calls.length, 0)
  const cross = await withFetch(
    () => Response.json({}),
    () => loginPost(req("/api/auth/login", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" })),
  )
  assert.equal(cross.res.status, 403)
  assert.equal(cross.calls.length, 0)
})

test("login : JSON de même origine → appel à l'API", async () => {
  const { calls, res } = await withFetch(
    () => Response.json({ error: "identifiants invalides" }, { status: 401 }),
    () => loginPost(req("/api/auth/login", { method: "POST", headers: { origin: SITE, "content-type": "application/json" }, body: '{"email":"a@b.c","password":"x"}' })),
  )
  assert.equal(calls.length, 1)
  assert.equal(res.status, 401)
})

test("logout : autre origine → 403 ; même origine → cookies effacés", async () => {
  assert.equal((await logoutPost(req("/api/auth/logout", { method: "POST", headers: { origin: "https://evil.example" } }))).status, 403)
  const ok = await logoutPost(req("/api/auth/logout", { method: "POST", headers: { origin: SITE } }))
  assert.equal(ok.status, 200)
  assert.match(ok.headers.get("set-cookie") ?? "", /access_token=;/)
})
