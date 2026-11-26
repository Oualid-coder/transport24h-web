// Mot de passe oublié, réinitialisation par lien, changement dans l'espace connecté (sujet 35).
import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { NextRequest } from "next/server"
import { POST as changePost } from "../app/api/auth/change-password/route"
import { ApiError, changePassword, requestPasswordReset, resetPassword } from "../lib/api"
import {
  buildChangePasswordBody,
  buildResetPasswordBody,
  changeErrorMessage,
  changePasswordSchema,
  forgotErrorMessage,
  forgotPasswordSchema,
  isResetLinkInvalid,
  RESET_LINK_INVALID_MESSAGE,
  resetErrorMessage,
  resetPasswordSchema,
  utf8Length,
} from "../lib/password"
import { onceReader, takeHashToken } from "../lib/url-token"

type Call = { url: string; init: RequestInit }
const original = globalThis.fetch
afterEach(() => {
  globalThis.fetch = original
})

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>): Call[] {
  const calls: Call[] = []
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    if (String(url).includes("api.transport24h.fr")) throw new Error("appel de production interdit en test")
    calls.push({ url: String(url), init })
    return handler(String(url), init)
  }) as typeof fetch // signature simplifiée suffisante pour le test
  return calls
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })

// ── Schémas ─────────────────────────────────────────────────────────────────

test("nouveau mot de passe : 8 caractères, un chiffre, 72 octets au plus (accents comptés en octets)", () => {
  const ok = (pw: string) => resetPasswordSchema.safeParse({ password: pw, confirmPassword: pw }).success
  assert.equal(ok("abcdefg1"), true)
  assert.equal(ok("abcdef1"), false) // 7
  assert.equal(ok("abcdefgh"), false) // pas de chiffre
  assert.equal(ok("1" + "a".repeat(71)), true) // 72 octets
  assert.equal(ok("1" + "a".repeat(72)), false) // 73 octets
  assert.equal(utf8Length("é"), 2)
  assert.equal(ok("1" + "é".repeat(36)), false) // 37 caractères, 73 octets
  assert.equal(resetPasswordSchema.safeParse({ password: "abcdefg1", confirmPassword: "abcdefg2" }).success, false)
})

test("changement : ancien requis, confirmation identique, nouveau différent de l'ancien", () => {
  const p = (currentPassword: string, newPassword: string, confirmPassword = newPassword) =>
    changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword })
  assert.equal(p("ancien-1", "nouveau-1").success, true)
  assert.equal(p("", "nouveau-1").success, false)
  assert.equal(p("ancien-1", "nouveau-1", "autre-1").success, false)
  const same = p("meme-mdp-1", "meme-mdp-1")
  assert.equal(same.success, false)
  assert.ok(!same.success && same.error.issues.some((i) => i.message.includes("différent")))
})

test("email : format et 254 caractères au plus", () => {
  assert.equal(forgotPasswordSchema.safeParse({ email: "a@example.com" }).success, true)
  assert.equal(forgotPasswordSchema.safeParse({ email: "pas-un-email" }).success, false)
  assert.equal(forgotPasswordSchema.safeParse({ email: "a".repeat(250) + "@x.fr" }).success, false)
})

test("corps envoyés : exactement les champs attendus par l'API", () => {
  assert.deepEqual(buildChangePasswordBody("a", "b"), { current_password: "a", new_password: "b" })
  assert.deepEqual(buildResetPasswordBody("tok", "pw"), { token: "tok", password: "pw" })
})

// ── Messages ────────────────────────────────────────────────────────────────

test("messages : 422 lien invalide reconnu, 403/422/409 de l'API, 429 avec délai, repli sinon", () => {
  const invalid = new ApiError(422, "lien de réinitialisation invalide, expiré ou déjà utilisé")
  assert.equal(isResetLinkInvalid(invalid), true)
  assert.equal(resetErrorMessage(invalid), RESET_LINK_INVALID_MESSAGE)
  assert.equal(isResetLinkInvalid(new ApiError(422, "le mot de passe doit contenir au moins 8 caractères")), false)
  assert.equal(resetErrorMessage(new ApiError(422, "le mot de passe doit contenir au moins 8 caractères")),
    "Le mot de passe doit contenir au moins 8 caractères")
  assert.equal(changeErrorMessage(new ApiError(403, "mot de passe actuel incorrect")), "Mot de passe actuel incorrect")
  assert.equal(changeErrorMessage(new ApiError(422, "le nouveau mot de passe doit être différent de l'actuel")),
    "Le nouveau mot de passe doit être différent de l'actuel")
  assert.match(forgotErrorMessage(new ApiError(429, "trop de demandes", 3600)), /réessayez dans 3600 s/)
  assert.match(changeErrorMessage(new ApiError(500, "erreur")), /n'a pas pu aboutir/)
  assert.match(forgotErrorMessage(new TypeError("réseau")), /n'a pas pu aboutir/)
})

// ── Jeton du lien : lu puis retiré de l'URL ──────────────────────────────────

test("jeton lu dans le fragment puis retiré aussitôt de la barre d'adresse", () => {
  const replaced: string[] = []
  const hist = { replaceState: (_d: unknown, _t: string, url?: string | URL | null) => { replaced.push(String(url)) } }
  const token = takeHashToken("token", { pathname: "/reset-password", search: "", hash: "#token=abc_DEF-123" }, hist)
  assert.equal(token, "abc_DEF-123")
  assert.deepEqual(replaced, ["/reset-password"])

  replaced.length = 0
  assert.equal(takeHashToken("token", { pathname: "/reset-password", search: "?x=1", hash: "#a=1&token=t" }, hist), "t")
  assert.deepEqual(replaced, ["/reset-password?x=1#a=1"])

  replaced.length = 0
  assert.equal(takeHashToken("token", { pathname: "/reset-password", search: "", hash: "" }, hist), null)
  assert.deepEqual(replaced, [], "rien à retirer : pas de replaceState")
  assert.equal(takeHashToken("token", undefined, undefined), null, "côté serveur : null")
})

test("Strict Mode : l'effet rejoué retrouve le même jeton (fragment lu et retiré une seule fois)", () => {
  const replaced: string[] = []
  const loc = { pathname: "/reset-password", search: "", hash: "#token=JETON" }
  const hist = {
    replaceState: (_d: unknown, _t: string, url?: string | URL | null) => {
      replaced.push(String(url))
      loc.hash = "" // le navigateur vide le fragment
    },
  }
  const read = onceReader(() => takeHashToken("token", loc, hist))
  assert.equal(read(), "JETON")
  assert.equal(read(), "JETON", "second passage de l'effet : jeton conservé")
  assert.deepEqual(replaced, ["/reset-password"])
  // Sans lecteur unique, le second passage perdrait le jeton (défaut constaté en next dev)
  assert.equal(takeHashToken("token", loc, hist), null)
})

// ── Appels ──────────────────────────────────────────────────────────────────

test("demande et réinitialisation : via le proxy, jeton et email dans le corps, jamais dans l'URL", async () => {
  const calls = mockFetch(() => new Response(null, { status: 202 }))
  await requestPasswordReset("a@example.com")
  await resetPassword(buildResetPasswordBody("SECRET-TOKEN", "nouveau-mdp-1"))
  assert.equal(calls[0].url, "/api/proxy/auth/forgot-password")
  assert.equal(calls[1].url, "/api/proxy/auth/reset-password")
  for (const c of calls) {
    assert.equal(c.init.method, "POST")
    assert.ok(!c.url.includes("SECRET-TOKEN") && !c.url.includes("@"))
  }
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { token: "SECRET-TOKEN", password: "nouveau-mdp-1" })
})

test("réinitialisation refusée (422) : ApiError avec le message de l'API, sans renouvellement de session", async () => {
  const calls = mockFetch(() => json(422, { error: "lien de réinitialisation invalide, expiré ou déjà utilisé" }))
  await assert.rejects(resetPassword(buildResetPasswordBody("t", "nouveau-mdp-1")), (err: unknown) => isResetLinkInvalid(err))
  assert.equal(calls.length, 1)
})

test("changement : 403 → ApiError (pas de redirection) ; 401 → un renouvellement puis un rejeu", async () => {
  mockFetch(() => json(403, { error: "mot de passe actuel incorrect" }))
  await assert.rejects(changePassword(buildChangePasswordBody("a", "b")), (err: unknown) =>
    err instanceof ApiError && err.status === 403 && err.message === "mot de passe actuel incorrect")

  let n = 0
  const calls = mockFetch((url) => {
    if (url === "/api/auth/refresh") return json(200, { ok: true })
    n++
    return n === 1 ? json(401, { error: "Session expirée" }) : json(200, { ok: true })
  })
  assert.deepEqual(await changePassword(buildChangePasswordBody("a", "b")), { relogin: false })
  assert.deepEqual(calls.map((c) => c.url), ["/api/auth/change-password", "/api/auth/refresh", "/api/auth/change-password"])

  mockFetch(() => json(200, { ok: true, relogin: true }))
  assert.deepEqual(await changePassword(buildChangePasswordBody("a", "b")), { relogin: true })
  assert.equal(calls[2].init.body, calls[0].init.body)

  mockFetch(() => json(429, { error: "trop de demandes" }, { "retry-after": "3600" }))
  await assert.rejects(changePassword(buildChangePasswordBody("a", "b")), (err: unknown) =>
    err instanceof ApiError && err.status === 429 && err.retryAfter === 3600)
})

// ── Route Handler /api/auth/change-password ──────────────────────────────────

const SITE = "http://transport24h.test"
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url")
const jwt = (role: string) => `${b64({ alg: "none" })}.${b64({ role, sub: "u1" })}.sig`
const routeReq = (headers: Record<string, string>, body = '{"current_password":"a","new_password":"b","extra":"x"}') =>
  new NextRequest(`${SITE}/api/auth/change-password`, {
    method: "POST",
    headers: { host: "transport24h.test", "content-type": "application/json", ...headers },
    body,
  })

test("route : access_token relayé en Bearer, seuls les deux champs envoyés, nouvelle session reposée", async () => {
  const calls = mockFetch(() => {
    const h = new Headers({ "content-type": "application/json" })
    h.append("set-cookie", "refresh_token=RT2; Path=/auth; Max-Age=604800; HttpOnly; Secure; SameSite=Strict")
    return new Response(JSON.stringify({ access_token: jwt("driver"), expires_in: 900 }), { status: 200, headers: h })
  })
  const res = await changePost(routeReq({ origin: SITE, cookie: "access_token=AT1", "x-real-ip": "203.0.113.5" }))
  assert.equal(res.status, 200)
  assert.match(calls[0].url, /\/auth\/change-password$/)
  const h = calls[0].init.headers as Record<string, string>
  assert.equal(h.Authorization, "Bearer AT1")
  assert.equal(h["X-Real-IP"], "203.0.113.5")
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { current_password: "a", new_password: "b" })
  const cookies = res.headers.getSetCookie()
  assert.ok(cookies.some((l) => /^refresh_token=RT2;/.test(l) && /Path=\/api\/auth/i.test(l) && /HttpOnly/i.test(l)), cookies.join("\n"))
  assert.ok(cookies.some((l) => l.startsWith("access_token=") && /HttpOnly/i.test(l)))
  assert.ok(cookies.some((l) => l.startsWith("user_role=driver")))
  assert.ok(!(await res.text()).includes("RT2"), "refresh token jamais dans le corps")
})

test("route : mot de passe changé sans nouvelle session → relogin, cookies de session effacés", async () => {
  mockFetch(() => json(200, { status: "changed", relogin: true }))
  const res = await changePost(routeReq({ origin: SITE, cookie: "access_token=AT1" }))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, relogin: true })
  const cookies = res.headers.getSetCookie()
  for (const name of ["access_token", "user_role", "refresh_token"]) {
    assert.ok(cookies.some((l) => l.startsWith(`${name}=;`) && /Max-Age=0/i.test(l)), `${name} non effacé : ${cookies.join("\n")}`)
  }
})

test("route : origine étrangère 403, corps non JSON 415, sans session 401, sans appel à l'API", async () => {
  const calls = mockFetch(() => json(200, {}))
  assert.equal((await changePost(routeReq({ origin: "https://evil.example", cookie: "access_token=AT1" }))).status, 403)
  assert.equal((await changePost(new NextRequest(`${SITE}/api/auth/change-password`, {
    method: "POST", headers: { host: "transport24h.test", "content-type": "text/plain", cookie: "access_token=AT1" }, body: "x",
  }))).status, 415)
  assert.equal((await changePost(routeReq({ origin: SITE }))).status, 401)
  assert.equal(calls.length, 0)
})

test("route : erreurs de l'API relayées (statut, message, Retry-After), aucun cookie posé", async () => {
  for (const [status, body, headers] of [
    [403, { error: "mot de passe actuel incorrect" }, {}],
    [422, { error: "le mot de passe doit contenir au moins 8 caractères" }, {}],
    [429, { error: "trop de demandes — réessayez dans une heure" }, { "retry-after": "3600" }],
    [401, { error: "token invalide" }, {}],
  ] as const) {
    mockFetch(() => json(status, body, headers))
    const res = await changePost(routeReq({ origin: SITE, cookie: "access_token=AT1" }))
    assert.equal(res.status, status)
    assert.deepEqual(await res.json(), body)
    assert.equal(res.headers.getSetCookie().length, 0)
    if (status === 429) assert.equal(res.headers.get("retry-after"), "3600")
  }
  mockFetch(() => { throw new TypeError("réseau") })
  assert.equal((await changePost(routeReq({ origin: SITE, cookie: "access_token=AT1" }))).status, 502)
})

// ── Sources : rien ne journalise ni n'envoie le jeton ailleurs ───────────────

test("sources : aucun console.* ni appel tiers dans les pages et la route du mot de passe ; no-referrer", () => {
  const files = [
    "app/forgot-password/page.tsx",
    "app/reset-password/page.tsx",
    "app/reset-password/layout.tsx",
    "app/api/auth/change-password/route.ts",
    "components/ChangePasswordForm.tsx",
    "lib/password.ts",
  ]
  for (const f of files) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8")
    assert.ok(!/console\.|sendAdsEvent|gtag|dataLayer|https?:\/\//.test(src), `${f} : journalisation ou appel externe`)
  }
  const layout = readFileSync(new URL("../app/reset-password/layout.tsx", import.meta.url), "utf8")
  assert.match(layout, /referrer:\s*"no-referrer"/)
  const page = readFileSync(new URL("../app/reset-password/page.tsx", import.meta.url), "utf8")
  assert.match(page, /useLayoutEffect\(/, "jeton retiré avant les useEffect (bandeau cookies, gtag)")
  assert.match(page, /takeHashToken\(\)/)
})
