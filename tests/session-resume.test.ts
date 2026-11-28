// Garde anti-boucle de /session sans dépendre de sessionStorage (sujet 54) : lib/session-resume.ts.
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  ATTEMPT_KEY,
  ATTEMPT_WINDOW_MS,
  RESUME_COOKIE,
  RESUME_LIMIT,
  recordResume,
  resumeCookieLine,
  resumeCount,
  resumeLimitReached,
  type ResumeGuardEnv,
} from "../lib/session-resume"

// Bocal à cookies minimal (comme document.cookie : écriture ligne par ligne, lecture « k=v; k2=v2 »)
function jar(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    read: () => [...store].map(([k, v]) => `${k}=${v}`).join("; "),
    write: (line: string) => {
      const [pair, ...attrs] = line.split(";")
      const [k, v] = pair.split("=")
      if (attrs.some((a) => /^\s*max-age=0\s*$/i.test(a))) store.delete(k.trim())
      else store.set(k.trim(), v)
    },
  }
}

function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

const securityError = () => {
  throw new DOMException("bloqué", "SecurityError")
}

type EnvOptions = { storage?: "ok" | "throws" | "null"; cookies?: "ok" | "ignored" | "throws"; now?: () => number }
function env({ storage = "ok", cookies = "ok", now = () => 1_000_000 }: EnvOptions = {}): ResumeGuardEnv & { lines: string[] } {
  const j = jar({ user_role: "client" })
  const s = memoryStorage()
  const lines: string[] = []
  return {
    lines,
    storage: () => (storage === "throws" ? securityError() : storage === "null" ? null : s),
    readCookies: () => (cookies === "throws" ? securityError() : j.read()),
    writeCookie: (line) => {
      lines.push(line)
      if (cookies === "throws") securityError()
      if (cookies === "ok") j.write(line)
    },
    now,
    secure: false,
  }
}

// Modèle de la page /session face à une API qui refuse toujours le jeton renouvelé : à chaque chargement,
// garde → arrêt, sinon refresh réussi → retour noté (sinon arrêt) → page protégée → 401 → /session.
function simulateLoop(e: ResumeGuardEnv, max = 50): number {
  let returns = 0
  for (let i = 0; i < max; i++) {
    if (resumeLimitReached(e)) return returns
    if (!recordResume(e)) return returns
    returns++
  }
  return returns
}

test("resumeCount : compteur lu dans le cookie, 0 si absent, illisible ou hors bornes", () => {
  assert.equal(resumeCount(""), 0)
  assert.equal(resumeCount("user_role=client"), 0)
  assert.equal(resumeCount(`consent=1; ${RESUME_COOKIE}=2; user_role=client`), 2)
  assert.equal(resumeCount(`${RESUME_COOKIE}=abc`), 0)
  assert.equal(resumeCount(`${RESUME_COOKIE}=-1`), 0)
  assert.equal(resumeCount(`${RESUME_COOKIE}=99999`), 0)
  assert.equal(resumeCount(`${RESUME_COOKIE}=`), 0)
  assert.equal(resumeCount(`x${RESUME_COOKIE}=5`), 0)
})

test("resumeCookieLine : compteur seul, Path=/session, 60 s, SameSite=Strict, Secure en HTTPS", () => {
  assert.equal(resumeCookieLine(1, false), `${RESUME_COOKIE}=1; Path=/session; Max-Age=60; SameSite=Strict`)
  assert.equal(resumeCookieLine(2, true), `${RESUME_COOKIE}=2; Path=/session; Max-Age=60; SameSite=Strict; Secure`)
})

test("stockage normal : un retour noté puis arrêt (comme avant, par onglet)", () => {
  const e = env()
  assert.equal(resumeLimitReached(e), false)
  assert.equal(recordResume(e), true)
  assert.equal(resumeLimitReached(e), true)
  assert.equal(simulateLoop(env()), 1)
})

test("stockage normal : aucune écriture du cookie (onglets indépendants, pas d'arrêt à tort en multi-onglets)", () => {
  const e = env()
  for (let i = 0; i < 10; i++) assert.equal(recordResume(e), true)
  assert.equal(e.lines.length, 0)
  assert.equal(resumeCount(e.readCookies()), 0)
  // Dix onglets (chacun son sessionStorage, cookie commun) : aucun n'atteint la borne
  const cookies = jar()
  for (let i = 0; i < 10; i++) {
    const tab: ResumeGuardEnv = { ...env(), readCookies: cookies.read, writeCookie: cookies.write }
    assert.equal(resumeLimitReached(tab), false, `onglet ${i + 1}`)
    assert.equal(recordResume(tab), true)
  }
})

test("stockage normal : marque de plus de 15 s ignorée", () => {
  let t = 1_000_000
  const e = env({ now: () => t })
  recordResume(e)
  t += ATTEMPT_WINDOW_MS
  assert.equal(resumeLimitReached(e), false)
  assert.equal(e.storage()?.getItem(ATTEMPT_KEY), "1000000")
})

for (const storage of ["throws", "null"] as const) {
  test(`stockage bloqué (${storage === "throws" ? "SecurityError" : "absent"}) : cookie compté, arrêt après ${RESUME_LIMIT} retours`, () => {
    const e = env({ storage })
    for (let i = 1; i <= RESUME_LIMIT; i++) {
      assert.equal(resumeLimitReached(e), false, `retour ${i}`)
      assert.equal(recordResume(e), true, `retour ${i} noté`)
    }
    assert.equal(resumeLimitReached(e), true)
    assert.equal(simulateLoop(env({ storage })), RESUME_LIMIT)
  })
}

test("stockage bloqué et cookie non enregistré : retour non noté → arrêt immédiat, jamais de boucle", () => {
  const e = env({ storage: "throws", cookies: "ignored" })
  assert.equal(resumeLimitReached(e), false)
  assert.equal(recordResume(e), false)
  assert.equal(simulateLoop(env({ storage: "throws", cookies: "ignored" })), 0)
})

test("stockage et document.cookie qui lèvent : aucune exception, retour non noté", () => {
  const e = env({ storage: "throws", cookies: "throws" })
  assert.equal(resumeLimitReached(e), false)
  assert.equal(recordResume(e), false)
  assert.equal(simulateLoop(env({ storage: "throws", cookies: "throws" })), 0)
})

test("cookie bloqué mais stockage disponible : la marque sessionStorage suffit", () => {
  const e = env({ cookies: "ignored" })
  assert.equal(recordResume(e), true)
  assert.equal(resumeLimitReached(e), true)
})

test("aucune combinaison de stockage et de cookies ne boucle (au plus RESUME_LIMIT retours)", () => {
  for (const storage of ["ok", "throws", "null"] as const) {
    for (const cookies of ["ok", "ignored", "throws"] as const) {
      const n = simulateLoop(env({ storage, cookies }))
      assert.ok(n <= RESUME_LIMIT, `${storage}/${cookies} : ${n} retours`)
    }
  }
})

test("cookie falsifié (valeur non numérique ou énorme) : compté comme 0, jamais d'URL lue", () => {
  const e = env({ storage: "throws" })
  e.writeCookie(`${RESUME_COOKIE}=https://evil.example`)
  assert.equal(resumeLimitReached(e), false)
  assert.equal(recordResume(e), true)
  assert.match(e.lines.at(-1) ?? "", new RegExp(`^${RESUME_COOKIE}=1;`))
})
