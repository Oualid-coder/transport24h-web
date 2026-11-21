import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError, partnerUploadHeaders, uploadPartnerDocument } from "../lib/api"
import {
  isPartnerLinkInvalid,
  partnerUploadErrorMessage,
  PARTNER_LINK_INVALID_MESSAGE,
} from "../lib/partner-upload"
import { hashParam, withoutHashParam } from "../lib/url-token"

// Jeton du lien d'envoi des documents partenaires : /partners?id=…#token=…

test("jeton lu dans le fragment", () => {
  assert.equal(hashParam("#token=abc_-9", "token"), "abc_-9")
  assert.equal(hashParam("token=abc", "token"), "abc")
  assert.equal(hashParam("#x=1&token=abc", "token"), "abc")
  assert.equal(hashParam("", "token"), null)
  assert.equal(hashParam("#token=", "token"), null)
  assert.equal(hashParam("#autre=1", "token"), null)
})

test("jeton retiré du fragment, identifiant et reste conservés", () => {
  assert.equal(withoutHashParam("/partners?id=42#token=abc", "token"), "/partners?id=42")
  assert.equal(withoutHashParam("/partners?id=42#x=1&token=abc", "token"), "/partners?id=42#x=1")
  assert.equal(withoutHashParam("/partners?id=42", "token"), "/partners?id=42")
})

test("401 et 403 : lien invalide, message et contact", () => {
  for (const status of [401, 403]) {
    const err = new ApiError(status, "texte de l'API")
    assert.equal(isPartnerLinkInvalid(err), true)
    assert.equal(partnerUploadErrorMessage(err), PARTNER_LINK_INVALID_MESSAGE)
  }
  assert.equal(PARTNER_LINK_INVALID_MESSAGE, "Ce lien n'est plus valide : demandez un nouveau lien à Transport24h.")
  assert.equal(isPartnerLinkInvalid(new ApiError(409, "déjà traitée")), false)
  assert.equal(isPartnerLinkInvalid(new Error("réseau")), false)
})

test("autres erreurs inchangées : 415 (message API), 409, repli", () => {
  assert.equal(
    partnerUploadErrorMessage(new ApiError(415, "le contenu du fichier ne correspond pas au type déclaré (image/jpeg)")),
    "Le contenu du fichier ne correspond pas au type déclaré (image/jpeg)",
  )
  assert.equal(
    partnerUploadErrorMessage(new ApiError(409, "la candidature a déjà été traitée : les documents ne peuvent plus être modifiés")),
    "La candidature a déjà été traitée : les documents ne peuvent plus être modifiés",
  )
  assert.equal(partnerUploadErrorMessage(new ApiError(500, "erreur lors de l'upload du document")), "Erreur lors de l'envoi.")
})

test("en-tête X-Upload-Token seulement si le jeton est connu", () => {
  assert.deepEqual(partnerUploadHeaders("application/pdf", "jeton"), { "Content-Type": "application/pdf", "X-Upload-Token": "jeton" })
  assert.deepEqual(partnerUploadHeaders("image/png", null), { "Content-Type": "image/png" })
  assert.deepEqual(partnerUploadHeaders("image/png", ""), { "Content-Type": "image/png" })
})

test("upload : jeton dans l'en-tête, jamais dans l'URL ; 403 → ApiError", async () => {
  const original = globalThis.fetch
  const calls: Array<{ url: string; init: RequestInit }> = []
  let status = 200
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(status === 200 ? { status: "uploaded" } : { error: "Ce lien n'est plus valide" }), { status })
  }) as typeof fetch
  try {
    const file = new File(["%PDF-1.7"], "kbis.pdf", { type: "application/pdf" })
    await uploadPartnerDocument("app-1", "kbis", file, "jeton-secret")
    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /\/partners\/app-1\/documents\/kbis$/)
    assert.equal(calls[0].url.includes("jeton-secret"), false)
    assert.deepEqual(calls[0].init.headers, { "Content-Type": "application/pdf", "X-Upload-Token": "jeton-secret" })

    status = 403
    await assert.rejects(uploadPartnerDocument("app-1", "kbis", file, "faux"), (err: unknown) => {
      return err instanceof ApiError && err.status === 403 && isPartnerLinkInvalid(err)
    })
  } finally {
    globalThis.fetch = original
  }
})
