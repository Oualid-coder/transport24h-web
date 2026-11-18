// Photos d'état des lieux : contrat avec l'API (handler driver.UploadPhoto, domain.BookingPhotoWithURL)
import { test } from "node:test"
import assert from "node:assert/strict"
import { getAdminBookingPhotos, getDriverBookingPhotos, toBookingPhotos, uploadBookingPhoto } from "../lib/api"
import { buildCsp } from "../lib/csp"

type Call = { url: string; init: RequestInit }

async function withFetch<T>(response: () => Response, run: () => Promise<T>): Promise<{ calls: Call[]; result: T }> {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return response()
  }) as typeof fetch // signature simplifiée suffisante pour le test
  try {
    const result = await run()
    return { calls, result }
  } finally {
    globalThis.fetch = original
  }
}

// Exemple de réponse réelle de l'API (map[phase][]*BookingPhotoWithURL)
const apiPhotos = {
  before: [
    {
      id: "0b0e7c1a-1111-4c1a-9a51-000000000001",
      phase: "before",
      url: "https://acct.r2.cloudflarestorage.com/bucket/bookings/b/before/1.jpg?X-Amz-Signature=abc",
      uploaded_by: "0b0e7c1a-2222-4c1a-9a51-000000000002",
      uploaded_at: "2026-11-17T09:00:00Z",
    },
  ],
  after: [],
}

test("upload photo : corps brut (le fichier), Content-Type image/*, pas de multipart", async () => {
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "photo.jpg", { type: "image/jpeg" })
  const { calls } = await withFetch(
    () => Response.json({ id: "x", phase: "before", uploaded_at: "2026-11-17T09:00:00Z" }, { status: 201 }),
    () => uploadBookingPhoto("b1", "before", file),
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "/api/proxy/driver/bookings/b1/photos/before")
  assert.equal(calls[0].init.method, "POST")
  assert.equal(calls[0].init.body, file)
  assert.ok(!(calls[0].init.body instanceof FormData))
  assert.equal(new Headers(calls[0].init.headers).get("content-type"), "image/jpeg")
})

test("upload photo : type de fichier vide → image/jpeg", async () => {
  const file = new File([new Uint8Array([1])], "photo")
  const { calls } = await withFetch(
    () => new Response(null, { status: 201 }),
    () => uploadBookingPhoto("b1", "after", file),
  )
  assert.equal(new Headers(calls[0].init.headers).get("content-type"), "image/jpeg")
})

test("upload photo : erreur API → message de l'API", async () => {
  const file = new File([new Uint8Array([1])], "doc.pdf", { type: "application/pdf" })
  await assert.rejects(
    withFetch(
      () => Response.json({ error: "Content-Type image/* requis" }, { status: 415 }),
      () => uploadBookingPhoto("b1", "before", file),
    ),
    { name: "ApiError", status: 415, message: "Content-Type image/* requis" },
  )
})

test("lecture photos : objets {url,…} de l'API → tableaux d'URL", async () => {
  assert.deepEqual(toBookingPhotos(apiPhotos), { before: [apiPhotos.before[0].url], after: [] })
  // Phase absente, null, URL vide (signature échouée côté API) : ignorées sans erreur
  assert.deepEqual(toBookingPhotos({ before: null, after: [{ url: "" }] }), { before: [], after: [] })
  assert.deepEqual(toBookingPhotos(undefined), { before: [], after: [] })

  for (const [get, path] of [
    [getAdminBookingPhotos, "/api/proxy/admin/bookings/b1/photos"],
    [getDriverBookingPhotos, "/api/proxy/driver/bookings/b1/photos"],
  ] as const) {
    const { calls, result } = await withFetch(() => Response.json(apiPhotos), () => get("b1"))
    assert.equal(calls[0].url, path)
    assert.deepEqual(result, { before: [apiPhotos.before[0].url], after: [] })
  }
})

test("CSP : img-src autorise les URL présignées R2, en HTTPS seulement", () => {
  const imgSrc = buildCsp("n").split("; ").find((d) => d.startsWith("img-src "))
  assert.ok(imgSrc)
  assert.ok(imgSrc.split(" ").includes("https://*.r2.cloudflarestorage.com"))
  assert.ok(!imgSrc.includes("http://*.r2"))
})
