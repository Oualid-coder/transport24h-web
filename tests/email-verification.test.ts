// Vérification d'email : contrat de l'API (branche feat/email-verification-v2)
// handler/auth.go (VerifyEmail, ResendVerification), handler/booking.go et handler/payment.go (403).
import { test } from "node:test"
import assert from "node:assert/strict"
import { ApiError, createBooking, createSetupIntent, parseRetryAfter, register, resendVerification, verifyEmail } from "../lib/api"
import {
  isEmailNotVerifiedError,
  resendErrorMessage,
  verifyEmailErrorMessage,
} from "../lib/email-verification"
import { registeredLoginUrl } from "../lib/register"

async function withFetch<T>(response: () => Response, run: () => Promise<T>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return response()
  }) as typeof fetch // signature simplifiée suffisante pour le test
  try {
    return { calls, result: await run() }
  } finally {
    globalThis.fetch = original
  }
}

test("verifyEmail : GET via le proxy, jeton encodé, réponse 200 { status: verified }", async () => {
  const token = "Ab-_9+/="
  const { calls, result } = await withFetch(
    () => Response.json({ status: "verified" }),
    () => verifyEmail(token),
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, `/api/proxy/auth/verify-email?token=${encodeURIComponent(token)}`)
  assert.equal(calls[0].init.method, undefined) // GET par défaut
  assert.equal(calls[0].init.body, undefined)
  assert.deepEqual(result, { status: "verified" })
})

test("verifyEmail : 400 et 422 → ApiError, messages de la page", async () => {
  for (const [status, msg] of [
    [400, "token manquant"],
    [422, "lien de vérification invalide, expiré ou déjà utilisé"],
  ] as const) {
    const err = await withFetch(() => Response.json({ error: msg }, { status }), () => verifyEmail("x")).catch(
      (e: unknown) => e,
    )
    assert.ok(err instanceof ApiError)
    assert.equal(err.status, status)
    assert.equal(err.message, msg)
  }
  assert.match(verifyEmailErrorMessage(new ApiError(400, "token manquant")), /incomplet/)
  assert.match(verifyEmailErrorMessage(new ApiError(422, "x")), /invalide, a expiré ou a déjà été utilisé/)
  assert.match(verifyEmailErrorMessage(new ApiError(502, "Backend inaccessible")), /joindre le serveur/)
  assert.match(verifyEmailErrorMessage(new TypeError("Failed to fetch")), /joindre le serveur/)
  assert.match(verifyEmailErrorMessage(new ApiError(500, "erreur")), /n'a pas pu aboutir/)
})

test("resendVerification : POST via le proxy sans corps, 200 { status: sent }", async () => {
  const { calls, result } = await withFetch(
    () => Response.json({ status: "sent" }),
    () => resendVerification(),
  )
  assert.equal(calls[0].url, "/api/proxy/auth/resend-verification")
  assert.equal(calls[0].init.method, "POST")
  assert.equal(calls[0].init.body, undefined)
  assert.deepEqual(result, { status: "sent" })
})

test("resendVerification : 429 → ApiError avec Retry-After, message avec le délai", async () => {
  const err = await withFetch(
    () =>
      Response.json(
        { error: "trop de demandes — réessayez dans une heure" },
        { status: 429, headers: { "Retry-After": "3600" } },
      ),
    () => resendVerification(),
  ).catch((e: unknown) => e)
  assert.ok(err instanceof ApiError)
  assert.equal(err.status, 429)
  assert.equal(err.retryAfter, 3600)
  assert.equal(resendErrorMessage(err), "Trop de demandes d'envoi. Réessayez dans 1 heure.")

  // Limite IP de la gateway : 3/min, Retry-After: 60
  assert.equal(resendErrorMessage(new ApiError(429, "trop de requêtes", 60)), "Trop de demandes d'envoi. Réessayez dans 1 minute.")
  assert.equal(resendErrorMessage(new ApiError(429, "trop de requêtes", 30)), "Trop de demandes d'envoi. Réessayez dans 30 secondes.")
  assert.equal(resendErrorMessage(new ApiError(429, "trop de requêtes")), "Trop de demandes d'envoi. Réessayez plus tard.")
  assert.equal(resendErrorMessage(new ApiError(500, "erreur lors du renvoi de l'email")), "erreur lors du renvoi de l'email")
  assert.match(resendErrorMessage(new TypeError("Failed to fetch")), /joindre le serveur/)
})

test("parseRetryAfter : secondes, date HTTP, absent ou illisible", () => {
  const now = Date.parse("2026-11-18T10:00:00Z")
  assert.equal(parseRetryAfter("120", now), 120)
  assert.equal(parseRetryAfter(" 60 ", now), 60)
  assert.equal(parseRetryAfter("Wed, 18 Nov 2026 10:05:00 GMT", now), 300)
  assert.equal(parseRetryAfter("Wed, 18 Nov 2026 09:00:00 GMT", now), 0)
  assert.equal(parseRetryAfter(null, now), null)
  assert.equal(parseRetryAfter("bientôt", now), null)
})

test("403 « vérifiez votre email » reconnu (réservation et paiement), autres 403 non", async () => {
  const booking = await withFetch(
    () => Response.json({ error: "vérifiez votre email avant de réserver" }, { status: 403 }),
    () => createBooking({ quote_id: "q1", scheduled_at: "2026-12-01T09:00:00+01:00" }),
  ).catch((e: unknown) => e)
  assert.equal(isEmailNotVerifiedError(booking), true)

  const payment = await withFetch(
    () => Response.json({ error: "vérifiez votre email avant de payer" }, { status: 403 }),
    () => createSetupIntent("b1"),
  ).catch((e: unknown) => e)
  assert.equal(isEmailNotVerifiedError(payment), true)

  for (const msg of [
    "ce devis ne vous appartient pas",
    "ce booking ne vous appartient pas",
    "seul le rôle 'client' est autorisé à l'inscription",
    "Forbidden",
  ]) {
    assert.equal(isEmailNotVerifiedError(new ApiError(403, msg)), false, msg)
  }
  // Même message mais autre statut : pas un blocage de vérification
  assert.equal(isEmailNotVerifiedError(new ApiError(422, "vérifiez votre email avant de réserver")), false)
  assert.equal(isEmailNotVerifiedError(new Error("vérifiez votre email avant de réserver")), false)
})

test("inscription : email_verified false → message de vérification sur la connexion", async () => {
  const { result } = await withFetch(
    () => Response.json({ id: "u1", email: "a@b.fr", role: "client", email_verified: false }, { status: 201 }),
    () => register({ email: "a@b.fr", password: "x", first_name: "A", last_name: "B", phone: "0612345678" }),
  )
  assert.equal(result.email_verified, false)
  assert.equal(registeredLoginUrl(null, false), "/login?registered=1&verify=sent")
  assert.equal(registeredLoginUrl(null, true), "/login?registered=1")
  assert.equal(registeredLoginUrl(null, undefined), "/login?registered=1")
  const withRedirect = new URL(registeredLoginUrl("/booking?step=2", false), "http://x")
  assert.equal(withRedirect.searchParams.get("verify"), "sent")
  assert.equal(withRedirect.searchParams.get("redirect"), "/booking?step=2")
})
