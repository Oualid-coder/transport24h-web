// Case « 18 ans + CGV + confidentialité » sur l'activation d'un compte entreprise et la candidature
// partenaire : corps réellement envoyé par lib/api.ts (fetch simulé). Lancer : npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { acceptInvitation, registerPartner } from "../lib/api"
import { TERMS_REQUIRED_MESSAGE, TERMS_VERSION } from "../lib/legal"
import {
  acceptTermsField,
  buildAcceptInvitationBody,
  buildPartnerApplyBody,
  type PartnerFormValues,
} from "../lib/register"

async function sentRequest(send: () => Promise<unknown>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify({ id: "app-1" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    })
  }) as typeof fetch // signature simplifiée suffisante pour le test
  try {
    await send()
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

const noDate = (body: Record<string, unknown>) => {
  for (const key of Object.keys(body)) assert.ok(!/_at$|date/i.test(key), key)
}

const partner: PartnerFormValues = {
  firstName: "Jean",
  lastName: "Dupont",
  email: "jean.dupont@example.com",
  phone: "0612345678",
  siret: "12345678901234",
  truckType: "12m3",
  acceptTerms: true,
}

test("activation entreprise, case cochée : terms_accepted + terms_version, sans date", async () => {
  const req = await sentRequest(() =>
    acceptInvitation(buildAcceptInvitationBody("jeton", "motdepasse1", true)),
  )
  assert.equal(req.url, "/api/proxy/auth/accept-invitation")
  assert.equal(req.method, "POST")
  assert.deepEqual(req.body, {
    token: "jeton",
    password: "motdepasse1",
    terms_accepted: true,
    terms_version: TERMS_VERSION,
  })
  noDate(req.body)
})

test("activation entreprise, case non cochée : aucun champ terms_*", () => {
  assert.deepEqual(buildAcceptInvitationBody("jeton", "motdepasse1", false), {
    token: "jeton",
    password: "motdepasse1",
  })
})

test("candidature partenaire, case cochée : terms_accepted + terms_version dans le JSON de la 1re étape, sans date", async () => {
  const req = await sentRequest(() => registerPartner(buildPartnerApplyBody(partner)))
  assert.equal(req.url, "/api/proxy/partners")
  assert.equal(req.method, "POST")
  assert.deepEqual(req.body, {
    first_name: "Jean",
    last_name: "Dupont",
    email: "jean.dupont@example.com",
    phone: "0612345678",
    siret: "12345678901234",
    truck_type: "12m3",
    terms_accepted: true,
    terms_version: TERMS_VERSION,
  })
  noDate(req.body)
})

test("candidature partenaire, case non cochée : aucun champ terms_*", () => {
  const body = buildPartnerApplyBody({ ...partner, acceptTerms: false })
  assert.equal("terms_accepted" in body, false)
  assert.equal("terms_version" in body, false)
})

test("case obligatoire : seul true passe, avec le message de l'inscription", () => {
  assert.equal(acceptTermsField.safeParse(true).success, true)
  for (const v of [false, undefined, "on", 1]) {
    const r = acceptTermsField.safeParse(v)
    assert.equal(r.success, false, String(v))
    assert.equal(r.error?.issues[0].message, TERMS_REQUIRED_MESSAGE)
  }
})
