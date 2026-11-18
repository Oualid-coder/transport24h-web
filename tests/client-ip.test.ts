// IP du visiteur transmise à l'API (audit H1) : helper, proxy et login
import { test } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { clientIpHeaders } from "../lib/client-ip"
import { POST as proxyPost, GET as proxyGet } from "../app/api/proxy/[...path]/route"
import { POST as loginPost } from "../app/api/auth/login/route"

type Call = { url: string; headers: Headers }

async function withFetch(response: () => Response, run: () => Promise<unknown>): Promise<Call[]> {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes("api.transport24h.fr")) throw new Error("appel de production interdit en test")
    calls.push({ url: String(url), headers: new Headers(init?.headers) })
    return response()
  }) as typeof fetch // signature simplifiée suffisante pour le test
  try {
    await run()
    return calls
  } finally {
    globalThis.fetch = original
  }
}

const h = (init: Record<string, string>) => new Headers(init)

test("helper : IPv4 et IPv6 valides transmises en X-Real-IP", () => {
  assert.deepEqual(clientIpHeaders(h({ "x-real-ip": "203.0.113.7" })), { "X-Real-IP": "203.0.113.7" })
  assert.deepEqual(clientIpHeaders(h({ "x-real-ip": " 2001:db8::1 " })), { "X-Real-IP": "2001:db8::1" })
})

test("helper : liste, valeur invalide ou absente → aucun en-tête", () => {
  assert.deepEqual(clientIpHeaders(h({ "x-real-ip": "203.0.113.7, 10.0.0.1" })), {})
  assert.deepEqual(clientIpHeaders(h({ "x-real-ip": "pas-une-ip" })), {})
  assert.deepEqual(clientIpHeaders(h({ "x-real-ip": "203.0.113.7:443" })), {})
  assert.deepEqual(clientIpHeaders(h({ "x-real-ip": "" })), {})
  assert.deepEqual(clientIpHeaders(h({})), {})
})

test("helper : x-forwarded-for et true-client-ip ignorés", () => {
  assert.deepEqual(clientIpHeaders(h({ "x-forwarded-for": "198.51.100.1", "true-client-ip": "198.51.100.2" })), {})
})

const spoofed = {
  "x-real-ip": "203.0.113.7",
  "x-forwarded-for": "198.51.100.1",
  "true-client-ip": "198.51.100.2",
  "forwarded": "for=198.51.100.3",
}

test("proxy : X-Real-IP transmis, ni X-Forwarded-For ni True-Client-IP", async () => {
  const req = new NextRequest("http://localhost:3000/api/proxy/contact", {
    method: "POST",
    headers: { ...spoofed, "content-type": "application/json", cookie: "access_token=jwt" },
    body: JSON.stringify({ a: 1 }),
  })
  const calls = await withFetch(
    () => Response.json({ ok: true }),
    () => proxyPost(req, { params: Promise.resolve({ path: ["contact"] }) }),
  )
  assert.equal(calls.length, 1)
  assert.deepEqual([...calls[0].headers.keys()].sort(), ["authorization", "content-type", "x-real-ip"])
  assert.equal(calls[0].headers.get("x-real-ip"), "203.0.113.7")
  assert.equal(calls[0].headers.get("authorization"), "Bearer jwt")
})

test("proxy : IP invalide → aucun en-tête d'IP", async () => {
  const req = new NextRequest("http://localhost:3000/api/proxy/bookings/me", {
    headers: { "x-real-ip": "1.2.3.4, 5.6.7.8" },
  })
  const calls = await withFetch(
    () => Response.json([]),
    () => proxyGet(req, { params: Promise.resolve({ path: ["bookings", "me"] }) }),
  )
  assert.deepEqual([...calls[0].headers.keys()], [])
})

test("login : X-Real-IP transmis, ni X-Forwarded-For ni True-Client-IP", async () => {
  const req = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { ...spoofed, "content-type": "application/json" },
    body: JSON.stringify({ email: "a@example.com", password: "x" }),
  })
  const calls = await withFetch(
    () => Response.json({ error: "identifiants invalides" }, { status: 401 }),
    () => loginPost(req),
  )
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /\/auth\/login$/)
  assert.deepEqual([...calls[0].headers.keys()].sort(), ["content-type", "x-real-ip"])
  assert.equal(calls[0].headers.get("x-real-ip"), "203.0.113.7")
})
