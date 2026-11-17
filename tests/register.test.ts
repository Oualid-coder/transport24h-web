// Lancer : npm test (Node >= 23.6 — suppression des types native, sans dépendance)
import { test } from "node:test"
import assert from "node:assert/strict"
import { register } from "../lib/api"
import { TERMS_VERSION, formatTermsDate } from "../lib/legal"
import {
  buildRegisterBody,
  isValidPhone,
  normalizePhone,
  registerErrorMessage,
  type RegisterFormValues,
} from "../lib/register"

const base: RegisterFormValues = {
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean.dupont@example.com",
  password: "motdepasse1",
  acceptTerms: true,
}

// Capture la requête réellement envoyée par lib/api.ts
async function sentRequest(form: RegisterFormValues) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(null, { status: 204 })
  }) as typeof fetch // signature simplifiée suffisante pour le test
  try {
    await register(buildRegisterBody(form))
  } finally {
    globalThis.fetch = original
  }
  assert.equal(calls.length, 1)
  return {
    url: calls[0].url,
    method: calls[0].init.method,
    body: JSON.parse(String(calls[0].init.body)) as Record<string, unknown>,
  }
}

test("case cochée : terms_accepted et terms_version envoyés, téléphone nettoyé", async () => {
  const req = await sentRequest({ ...base, phone: "06 12.34-56 78" })
  assert.equal(req.url, "/api/proxy/auth/register")
  assert.equal(req.method, "POST")
  assert.deepEqual(req.body, {
    first_name: "Jean",
    last_name: "Dupont",
    email: "jean.dupont@example.com",
    password: "motdepasse1",
    phone: "0612345678",
    terms_accepted: true,
    terms_version: TERMS_VERSION,
  })
})

test("jamais de date d'acceptation envoyée", async () => {
  const req = await sentRequest(base)
  for (const key of Object.keys(req.body)) assert.ok(!/_at$|date/i.test(key), key)
})

test("sans téléphone (absent ou vide) : champ phone absent", async () => {
  assert.equal("phone" in (await sentRequest(base)).body, false)
  assert.equal("phone" in (await sentRequest({ ...base, phone: "" })).body, false)
  assert.equal("phone" in (await sentRequest({ ...base, phone: "  " })).body, false)
})

test("case non cochée : aucun champ terms_* envoyé", async () => {
  const req = await sentRequest({ ...base, acceptTerms: false })
  assert.equal("terms_accepted" in req.body, false)
  assert.equal("terms_version" in req.body, false)
})

test("TERMS_VERSION respecte le format exigé par l'API", () => {
  assert.match(TERMS_VERSION, /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/)
  assert.equal(TERMS_VERSION, "2026-11-17")
  assert.equal(formatTermsDate(), "17 novembre 2026")
})

test("téléphone : nettoyage et validation alignés sur l'API ^(0|\\+33)[1-9][0-9]{8}$", () => {
  assert.equal(normalizePhone("+33 6 12 34 56 78"), "+33612345678")
  assert.equal(normalizePhone("06 12 34 56 78"), "0612345678")
  for (const ok of ["0612345678", "06 12 34 56 78", "06.12.34.56.78", "06-12-34-56-78", "+33 6 12 34 56 78"])
    assert.ok(isValidPhone(ok), ok)
  for (const ko of ["0012345678", "061234567", "06123456789", "+33 06 12 34 56 78", "(06) 12 34 56 78", "abc"])
    assert.ok(!isValidPhone(ko), ko)
  // Tout numéro accepté côté client est accepté par la regex de l'API une fois nettoyé
  for (const ok of ["06 12 34 56 78", "+33 6.12.34.56.78"])
    assert.match(buildRegisterBody({ ...base, phone: ok }).phone ?? "", /^(0|\+33)[1-9][0-9]{8}$/)
})

test("erreurs API : 422 traduit en message lisible, jamais le texte technique", () => {
  const raw = "Key: 'registerRequest.Phone' Error:Field validation for 'Phone' failed on the 'phone_fr' tag"
  const msg = registerErrorMessage(422, raw)
  assert.match(msg, /téléphone invalide/)
  assert.ok(!msg.includes("Key:"))
  assert.match(registerErrorMessage(422, "Key: 'registerRequest.TermsVersion' Error:..."), /conditions/)
  assert.match(registerErrorMessage(422, "Key: 'registerRequest.Email' Error:..."), /e-mail invalide/)
  assert.match(registerErrorMessage(422, "inconnu"), /Vérifiez le formulaire/)
  assert.equal(registerErrorMessage(409, "cet email est déjà utilisé"), "Un compte existe déjà avec cet e-mail.")
  assert.equal(registerErrorMessage(500, "erreur lors de la création du compte"), "erreur lors de la création du compte")
})
