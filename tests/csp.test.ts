// CSP à nonce par requête (audit M8) : politique et proxy.ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { buildCsp, generateNonce } from "../lib/csp"
import { config, isProtectedPath, proxy } from "../proxy"

function directive(csp: string, name: string): string[] {
  const found = csp.split("; ").find((d) => d.startsWith(name + " "))
  assert.ok(found, `directive ${name} absente`)
  return found.split(" ").slice(1)
}

test("CSP : script-src = nonce + strict-dynamic (CSP3), replis CSP2/CSP1 ensuite, pas d'unsafe-eval en production", () => {
  const csp = buildCsp("abc123")
  const script = directive(csp, "script-src")
  // Les navigateurs CSP3 ignorent 'unsafe-inline' et les domaines dès que nonce + 'strict-dynamic' sont là
  assert.deepEqual(script.slice(0, 3), ["'self'", "'nonce-abc123'", "'strict-dynamic'"])
  assert.ok(script.includes("'unsafe-inline'"))
  for (const host of ["https://js.stripe.com", "https://www.googletagmanager.com"]) assert.ok(script.includes(host), host)
  assert.ok(!csp.includes("unsafe-eval"))
})

test("CSP : unsafe-eval seulement en développement", () => {
  assert.ok(directive(buildCsp("n", true), "script-src").includes("'unsafe-eval'"))
})

test("CSP : autres directives inchangées", () => {
  const csp = buildCsp("n")
  assert.deepEqual(directive(csp, "style-src"), ["'self'", "'unsafe-inline'"])
  assert.deepEqual(directive(csp, "frame-ancestors"), ["'none'"])
  assert.deepEqual(directive(csp, "object-src"), ["'none'"])
  assert.ok(directive(csp, "frame-src").includes("https://js.stripe.com"))
  assert.ok(directive(csp, "frame-src").includes("https://hooks.stripe.com"))
  assert.ok(directive(csp, "img-src").includes("https://*.tile.openstreetmap.org"))
  const connect = directive(csp, "connect-src")
  for (const host of ["https://api.stripe.com", "https://hooks.stripe.com", "https://nominatim.openstreetmap.org"]) {
    assert.ok(connect.includes(host), host)
  }
})

test("nonce : imprévisible, différent à chaque appel, base64", () => {
  const nonces = new Set(Array.from({ length: 100 }, generateNonce))
  assert.equal(nonces.size, 100)
  for (const n of nonces) assert.match(n, /^[A-Za-z0-9+/]+=*$/)
})

test("proxy : page publique → CSP avec nonce sur la réponse et transmise à Next.js", () => {
  const res1 = proxy(new NextRequest("http://localhost/cgv"))
  const res2 = proxy(new NextRequest("http://localhost/cgv"))
  const csp1 = res1.headers.get("content-security-policy") ?? ""
  const csp2 = res2.headers.get("content-security-policy") ?? ""
  const nonce1 = /'nonce-([^']+)'/.exec(csp1)?.[1]
  assert.ok(nonce1)
  assert.notEqual(csp1, csp2)
  // En-têtes de requête réécrits pour le rendu (mécanisme de NextResponse.next({ request }))
  assert.equal(res1.headers.get("x-middleware-request-x-nonce"), nonce1)
  assert.equal(res1.headers.get("x-middleware-request-content-security-policy"), csp1)
  assert.equal(res1.headers.get("location"), null)
})

test("proxy : page protégée sans jeton → /session, avec jeton → CSP", () => {
  const redirect = proxy(new NextRequest("http://localhost/booking/payment?id=b1"))
  assert.equal(redirect.status, 307)
  assert.equal(redirect.headers.get("location"), "http://localhost/session?redirect=%2Fbooking%2Fpayment%3Fid%3Db1")

  const ok = proxy(new NextRequest("http://localhost/admin/dashboard", { headers: { cookie: "access_token=t" } }))
  assert.equal(ok.headers.get("location"), null)
  assert.ok(ok.headers.get("content-security-policy")?.includes("'nonce-"))
})

test("proxy : préfixes protégés au segment près", () => {
  for (const p of ["/admin", "/admin/x", "/driver/dashboard", "/dashboard", "/booking", "/booking/confirmation"]) {
    assert.ok(isProtectedPath(p), p)
  }
  for (const p of ["/", "/bookingx", "/administrateur", "/cgv", "/session", "/login"]) {
    assert.ok(!isProtectedPath(p), p)
  }
})

test("proxy : matcher couvre toutes les pages, pas l'API ni les fichiers statiques", () => {
  const re = new RegExp("^" + config.matcher[0] + "$")
  for (const p of ["/", "/cgv", "/booking/payment", "/admin/dashboard", "/session", "/logo-transport24h.png", "/apidocs"]) {
    assert.ok(re.test(p), p)
  }
  for (const p of ["/api/proxy/bookings", "/_next/static/chunks/a.js", "/_next/image", "/favicon.ico"]) {
    assert.ok(!re.test(p), p)
  }
})

test("zod importé via @/lib/zod : mode jitless (pas de sonde new Function signalée par la CSP)", async () => {
  const z = await import("../lib/zod")
  assert.equal(z.config().jitless, true)
  // Les schémas restent fonctionnels sans JIT
  assert.equal(z.object({ a: z.string() }).safeParse({ a: "x" }).success, true)
})
