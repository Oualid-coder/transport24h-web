// Relevé des courses d'une entreprise (sujet 17) : périodes en dates civiles, requêtes (aucun
// identifiant d'entreprise dans la vue company), rendu company sans données admin, libellés,
// noms de fichiers, relais binaire par /api/proxy. Lancer : npm test
import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { GET as proxyGet } from "../app/api/proxy/[...path]/route"
import { ApiError, downloadBookingsReport, getBookingsReport, getReportPhotos } from "../lib/api"
import {
  NOT_RECORDED,
  cancelNoticeLabel,
  completedLabel,
  daysInMonth,
  driverName,
  filenameFromDisposition,
  formatParis,
  monthRange,
  parisToday,
  photosApiPath,
  photosErrorMessage,
  totalsNote,
  recentMonths,
  reportColumns,
  reportErrorMessage,
  exportErrorMessage,
  companyErrorMessage,
  reportFilename,
  reportPath,
  reportTotalsLines,
  sanitizeReport,
  statusLabel,
  validatePeriod,
  type ReportFilters,
} from "../lib/bookings-report"
import type { BookingsReport, ReportBooking } from "../lib/types"

const original = globalThis.fetch
afterEach(() => {
  globalThis.fetch = original
})

type Call = { url: string; init: RequestInit }
function mockFetch(handler: (url: string) => Response): Call[] {
  const calls: Call[] = []
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    return handler(String(url))
  }) as typeof fetch // signature simplifiée suffisante pour le test
  return calls
}

const NOV: ReportFilters = { from: "2026-11-01", to: "2026-11-30", status: "all" }

// ── Mois ──────────────────────────────────────────────────────────────────────

test("mois : du 1er au dernier jour, mars et octobre (changements d'heure) compris", () => {
  assert.deepEqual(monthRange(2026, 3), { from: "2026-03-01", to: "2026-03-31" })
  assert.deepEqual(monthRange(2026, 10), { from: "2026-10-01", to: "2026-10-31" })
  assert.deepEqual(monthRange(2026, 11), { from: "2026-11-01", to: "2026-11-30" })
  assert.deepEqual(monthRange(2026, 2), { from: "2026-02-01", to: "2026-02-28" })
  assert.deepEqual(monthRange(2028, 2), { from: "2028-02-01", to: "2028-02-29" })
  assert.deepEqual(monthRange(2026, 12), { from: "2026-12-01", to: "2026-12-31" })
  assert.equal(daysInMonth(2100, 2), 28)
})

test("mois courant pris à Paris : minuit passé à Paris, encore la veille en UTC", () => {
  // 31/10 23:30 UTC = 01/11 00:30 à Paris (heure d'hiver, juste après le changement du 25/10)
  assert.deepEqual(parisToday(new Date("2026-10-31T23:30:00Z")), { year: 2026, month: 11, day: 1 })
  assert.equal(recentMonths(new Date("2026-10-31T23:30:00Z"))[0].value, "2026-11")
  // 31/03 22:30 UTC = 01/04 00:30 à Paris (heure d'été depuis le 29/03)
  assert.equal(recentMonths(new Date("2026-03-31T22:30:00Z"))[0].value, "2026-04")
  // 31/03 21:30 UTC = 31/03 23:30 à Paris : encore mars
  const march = recentMonths(new Date("2026-03-31T21:30:00Z"))[0]
  assert.deepEqual([march.value, march.from, march.to, march.label], ["2026-03", "2026-03-01", "2026-03-31", "mars 2026"])
})

test("mois : courant puis précédents, passage d'année", () => {
  const months = recentMonths(new Date("2027-01-15T12:00:00Z"), 4)
  assert.deepEqual(months.map((m) => m.value), ["2027-01", "2026-12", "2026-11", "2026-10"])
  assert.deepEqual(months.map((m) => m.label), ["janvier 2027", "décembre 2026", "novembre 2026", "octobre 2026"])
  assert.deepEqual([months[3].from, months[3].to], ["2026-10-01", "2026-10-31"])
  assert.equal(recentMonths(new Date("2026-11-24T10:00:00Z")).length, 12)
})

test("dates saisies : format, existence, ordre", () => {
  assert.equal(validatePeriod("2026-11-01", "2026-11-30"), null)
  assert.equal(validatePeriod("2026-11-30", "2026-11-30"), null)
  assert.match(validatePeriod("2026-12-01", "2026-11-30") ?? "", /postérieure ou égale/)
  assert.match(validatePeriod("", "2026-11-30") ?? "", /date de début/)
  assert.match(validatePeriod("2026-02-30", "2026-03-01") ?? "", /date de début/)
})

// ── Requêtes ──────────────────────────────────────────────────────────────────

test("chemins : admin avec l'entreprise, company sans aucun identifiant d'entreprise", () => {
  assert.equal(
    reportPath({ view: "admin", companyId: "c 1/x" }, "json", NOV),
    "/admin/companies/c%201%2Fx/bookings-report?from=2026-11-01&to=2026-11-30&status=all",
  )
  assert.equal(
    reportPath({ view: "admin", companyId: "c1" }, "xlsx", { ...NOV, status: "done" }),
    "/admin/companies/c1/bookings-report.xlsx?from=2026-11-01&to=2026-11-30&status=done",
  )
  for (const format of ["json", "xlsx", "pdf"] as const) {
    const path = reportPath({ view: "company" }, format, { ...NOV, status: "cancelled" })
    assert.ok(path.startsWith(`/b2b/bookings-report${format === "json" ? "" : "." + format}?`), path)
    const qs = new URLSearchParams(path.split("?")[1])
    assert.deepEqual([...qs.keys()], ["from", "to", "status"])
    assert.doesNotMatch(path, /company/)
  }
})

test("vue company : requêtes JSON et export envoyées sans company_id, via le proxy", async () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0xff])
  const calls = mockFetch((url) =>
    url.includes(".pdf")
      ? new Response(pdf, {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="releve-acme-2026-11-01_2026-11-30.pdf"',
          },
        })
      : Response.json({}),
  )
  // Filtres porteurs d'un champ parasite : jamais recopié dans la requête
  const filters = { ...NOV, company_id: "autre" } as ReportFilters // champ en trop volontaire
  await getBookingsReport({ view: "company" }, filters)
  const { blob, filename } = await downloadBookingsReport({ view: "company" }, filters, "pdf")
  assert.deepEqual(calls.map((c) => c.url), [
    "/api/proxy/b2b/bookings-report?from=2026-11-01&to=2026-11-30&status=all",
    "/api/proxy/b2b/bookings-report.pdf?from=2026-11-01&to=2026-11-30&status=all",
  ])
  assert.equal(filename, "releve-acme-2026-11-01_2026-11-30.pdf")
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), pdf)
  // Pas de Content-Type JSON imposé sur le téléchargement
  assert.equal(new Headers(calls[1].init.headers).get("content-type"), null)
})

test("export en erreur : ApiError avec le message de l'API (422 période trop longue)", async () => {
  mockFetch(() => Response.json({ error: "La période ne peut pas dépasser 366 jours." }, { status: 422 }))
  await assert.rejects(
    downloadBookingsReport({ view: "admin", companyId: "c1" }, NOV, "xlsx"),
    (err: unknown) => err instanceof ApiError && err.status === 422 && err.message === "La période ne peut pas dépasser 366 jours.",
  )
})

// ── Rendu company sans données admin ──────────────────────────────────────────

function booking(over: Partial<ReportBooking> = {}): ReportBooking {
  return {
    id: "b1",
    reference: "T24H-0001",
    created_at: "2026-11-02T09:00:00Z",
    created_by: { first_name: "Léa", last_name: "Martin", email: "lea@acme.test" },
    scheduled_at: "2026-11-10T08:00:00Z",
    completed_at: "2026-11-10T11:00:00Z",
    completed_at_recorded: true,
    pickup_address: "1 rue A, Paris",
    delivery_address: "2 rue B, Lyon",
    distance_km: 465.2,
    volume_m3: 12,
    truck_type: "12m3",
    helpers_count: 1,
    client_comment: null,
    driver: { first_name: "Paul", last_name: "Durand" },
    status: "done",
    cancelled_at: null,
    cancel_notice_minutes: null,
    history_recorded: true,
    history: [],
    photos: { before: true, after: false, admin_url: "/admin/bookings/b1/photos" },
    reference_price: { ht: 500, vat_rate: 0.2, ttc: 600, indicative: true },
    ...over,
  }
}

function adminReport(): BookingsReport {
  return {
    view: "admin",
    company: { id: "c1", name: "Acme" },
    period: { from: "2026-11-01", to: "2026-11-30", timezone: "Europe/Paris" },
    generated_at: "2026-11-24T10:00:00Z",
    bookings: [booking()],
    totals: {
      count: 1,
      by_status: { done: 1, cancelled: 0, upcoming: 0, other: 0 },
      distance_km: 465.2,
      volume_m3: 12,
      reference_price_ht: 500,
      reference_price_ttc: 600,
    },
  }
}

test("colonnes : la vue company n'a aucune colonne de prix, la vue admin la marque indicative et interne", () => {
  const company = reportColumns("company")
  assert.ok(!company.some((c) => c.key === "reference_price"))
  assert.ok(!company.some((c) => /prix|tarif|€/i.test(c.label)))
  const admin = reportColumns("admin")
  const price = admin.find((c) => c.key === "reference_price")
  assert.equal(price?.label, "Prix de référence (indicatif, interne)")
  assert.deepEqual(admin.slice(0, company.length), company)
})

test("totaux : prix de référence en vue admin seulement, même si l'API les renvoyait en vue company", () => {
  const totals = adminReport().totals
  const company = reportTotalsLines("company", totals)
  assert.ok(!company.some((l) => /prix/i.test(l.label) || l.value.includes("€")))
  assert.deepEqual(company.map((l) => l.label), [
    "Courses", "Réalisées", "Annulées", "À venir", "Autres", "Distance totale", "Volume total",
  ])
  const admin = reportTotalsLines("admin", totals)
  assert.deepEqual(admin.slice(-2).map((l) => [l.label, l.value.replace(/\s/g, " ")]), [
    ["Prix de référence HT (indicatif, interne)", "500,00 €"],
    ["Prix de référence TTC (indicatif, interne)", "600,00 €"],
  ])
})

test("totaux : mention « hors courses annulées » (prix cités en vue admin seulement)", () => {
  assert.equal(totalsNote("admin"), "Distance, volume et prix de référence : hors courses annulées.")
  assert.equal(totalsNote("company"), "Distance et volume : hors courses annulées.")
})

test("garde-fou company : prix, lien photos admin et nom du chauffeur retirés avant le rendu", () => {
  const clean = sanitizeReport(adminReport(), "company")
  const b = clean.bookings[0]
  assert.equal("reference_price" in b, false)
  assert.equal(b.photos.admin_url, null)
  assert.equal(b.driver?.last_name, null)
  assert.equal("reference_price_ht" in clean.totals, false)
  assert.equal("reference_price_ttc" in clean.totals, false)
  assert.doesNotMatch(JSON.stringify(clean), /Durand|admin\/bookings|reference_price/)
  // Vue admin : inchangée
  assert.deepEqual(sanitizeReport(adminReport(), "admin"), adminReport())
})

test("chauffeur et photos selon la vue", () => {
  const d = { first_name: "Paul", last_name: "Durand" }
  assert.equal(driverName("admin", d), "Paul Durand")
  assert.equal(driverName("company", d), "Paul")
  assert.equal(driverName("company", null), "—")
  const photos = { before: true, after: true, admin_url: "/admin/bookings/0b6e4f1c-9d7e-4a51-8f43-2a1c5d6e7f80/photos" }
  assert.equal(photosApiPath("admin", photos), "/admin/bookings/0b6e4f1c-9d7e-4a51-8f43-2a1c5d6e7f80/photos")
  assert.equal(photosApiPath("company", photos), null)
  for (const bad of [
    null, "https://files.example/p", "//evil.example/admin/bookings/x/photos", "javascript:alert(1)",
    "/admin/bookings/../users/photos", "/admin/bookings/x/photos?y=1", "/admin/companies/x", "/admin/bookings/x/photos/before",
  ]) {
    assert.equal(photosApiPath("admin", { ...photos, admin_url: bad }), null, String(bad))
  }
})

test("« Voir les photos » : appelle admin_url via le proxy, URLs signées avant/après", async () => {
  const calls = mockFetch(() =>
    Response.json({
      before: [{ id: "p1", phase: "before", url: "https://acc.r2.cloudflarestorage.com/a.jpg?X-Amz-Signature=s", uploaded_by: "u", uploaded_at: "2026-11-05T08:00:00Z" }],
      after: [],
    }),
  )
  const photos = await getReportPhotos("/admin/bookings/b1/photos")
  assert.equal(calls[0].url, "/api/proxy/admin/bookings/b1/photos")
  assert.deepEqual(photos, { before: ["https://acc.r2.cloudflarestorage.com/a.jpg?X-Amz-Signature=s"], after: [] })
  assert.equal(photosErrorMessage(new ApiError(404, "réservation introuvable")), "Les photos n'ont pas pu être chargées.")
})

// ── Libellés ──────────────────────────────────────────────────────────────────

test("« non enregistré » quand la date de réalisation n'était pas enregistrée", () => {
  assert.equal(NOT_RECORDED, "non enregistré")
  assert.equal(completedLabel({ completed_at: null, completed_at_recorded: false }), "non enregistré")
  assert.equal(completedLabel({ completed_at: "2026-11-10T11:00:00Z", completed_at_recorded: false }), "non enregistré")
  assert.equal(completedLabel({ completed_at: null, completed_at_recorded: true }), "—")
  assert.equal(completedLabel({ completed_at: "2026-11-10T11:00:00Z", completed_at_recorded: true }), "10/11/2026 12:00")
})

test("heures de Paris, heure d'été et d'hiver", () => {
  assert.equal(formatParis("2026-07-01T22:15:00Z"), "02/07/2026 00:15")
  assert.equal(formatParis("2026-11-24T13:30:00Z"), "24/11/2026 14:30")
  // Changement d'heure du 29/03/2026 à 01:00 UTC
  assert.equal(formatParis("2026-03-29T00:30:00Z"), "29/03/2026 01:30")
  assert.equal(formatParis("2026-03-29T01:30:00Z"), "29/03/2026 03:30")
  // Format final de l'API : RFC 3339 avec le décalage de Paris
  assert.equal(formatParis("2026-11-05T09:00:00+01:00"), "05/11/2026 09:00")
  assert.equal(formatParis("2026-07-14T23:30:00+02:00"), "14/07/2026 23:30")
  assert.equal(formatParis("2026-10-25T02:30:00+01:00"), "25/10/2026 02:30") // seconde 02:30 de la nuit du changement
  assert.equal(formatParis("2026-03-29T03:00:00+02:00"), "29/03/2026 03:00")
  assert.equal(completedLabel({ completed_at: "2026-11-05T12:05:00+01:00", completed_at_recorded: true }), "05/11/2026 12:05")
  assert.equal(formatParis(null), "—")
  assert.equal(formatParis("pas une date"), "—")
})

test("statut assigned : « Chauffeur affecté », comme les exports de l'API", () => {
  assert.equal(statusLabel("assigned"), "Chauffeur affecté")
  assert.equal(statusLabel("inconnu"), "inconnu")
})

test("délai d'annulation lisible", () => {
  assert.equal(cancelNoticeLabel(200), "3 h 20 avant la course")
  assert.equal(cancelNoticeLabel(185), "3 h 05 avant la course")
  assert.equal(cancelNoticeLabel(180), "3 h 00 avant la course")
  assert.equal(cancelNoticeLabel(45), "45 min avant la course")
  assert.equal(cancelNoticeLabel(1500), "1 j 1 h 00 avant la course")
  assert.equal(cancelNoticeLabel(2880), "2 j 0 h 00 avant la course")
  assert.equal(cancelNoticeLabel(2370), "1 j 15 h 30 avant la course")
  assert.equal(cancelNoticeLabel(0), "à l'heure prévue de la course")
  assert.equal(cancelNoticeLabel(-30), "30 min après l'heure prévue de la course")
  assert.equal(cancelNoticeLabel(null), null)
})

// ── Noms de fichiers ──────────────────────────────────────────────────────────

test("nom du fichier repris de Content-Disposition, réduit au nom seul", () => {
  assert.equal(filenameFromDisposition('attachment; filename="releve-acme-2026-11-01_2026-11-30.xlsx"'), "releve-acme-2026-11-01_2026-11-30.xlsx")
  assert.equal(filenameFromDisposition("attachment; filename=releve-acme.pdf"), "releve-acme.pdf")
  assert.equal(
    filenameFromDisposition(`attachment; filename="releve.pdf"; filename*=UTF-8''rel%C3%A8ve-soci%C3%A9t%C3%A9.pdf`),
    "relève-société.pdf",
  )
  assert.equal(filenameFromDisposition('attachment; filename="../../etc/x.pdf"'), "x.pdf")
  assert.equal(filenameFromDisposition('attachment; filename="..\\\\x.pdf"'), "x.pdf")
  assert.equal(filenameFromDisposition("attachment"), null)
  assert.equal(filenameFromDisposition('attachment; filename=".."'), null)
  assert.equal(filenameFromDisposition(null), null)
  assert.equal(reportFilename(null, NOV, "xlsx"), "releve-2026-11-01_2026-11-30.xlsx")
  assert.equal(reportFilename('attachment; filename="a.pdf"', NOV, "pdf"), "a.pdf")
})

// ── Erreurs ───────────────────────────────────────────────────────────────────

test("erreurs : 422 de l'API, 404 (entreprise inconnue ou route absente), 403", () => {
  const e422 = new ApiError(422, "La période ne peut pas dépasser 366 jours.")
  assert.equal(reportErrorMessage(e422, "admin"), "La période ne peut pas dépasser 366 jours.")
  assert.equal(reportErrorMessage(new ApiError(404, "404 page not found"), "admin"),
    "Relevé indisponible : entreprise introuvable ou service pas encore à jour.")
  assert.equal(reportErrorMessage(new ApiError(404, "Not Found"), "company"),
    "Le relevé des courses n'est pas encore disponible, réessayez plus tard.")
  assert.equal(reportErrorMessage(new ApiError(403, "aucune entreprise associée à ce compte"), "company"),
    "Aucune entreprise associée à ce compte")
  assert.equal(reportErrorMessage(new ApiError(403, 'rôle insuffisant : "client"'), "company"),
    "Accès réservé : cette page n'est pas disponible pour votre compte.")
  assert.equal(reportErrorMessage(new ApiError(500, "boom"), "admin"), "Impossible de charger le relevé des courses.")
  // Messages exacts du contrat final, affichés tels quels
  for (const msg of [
    "Les dates from et to sont obligatoires (format AAAA-MM-JJ).",
    "Date invalide : format attendu AAAA-MM-JJ.",
    "La date de fin doit être postérieure ou égale à la date de début.",
    "La période ne peut pas dépasser 366 jours.",
    "Statut invalide : all, done, cancelled ou upcoming.",
    "Plus de 5 000 courses sur la période : réduisez la période ou filtrez par statut.",
  ]) {
    assert.equal(reportErrorMessage(new ApiError(422, msg), "company"), msg)
    assert.equal(exportErrorMessage(new ApiError(422, msg), "admin"), msg)
  }
  assert.equal(reportErrorMessage(new ApiError(403, "Ce compte n'est rattaché à aucune entreprise."), "company"),
    "Ce compte n'est rattaché à aucune entreprise.")
  // 400 « id d'entreprise invalide » (URL admin non UUID) : traité comme introuvable
  assert.equal(reportErrorMessage(new ApiError(400, "id d'entreprise invalide"), "admin"),
    "Relevé indisponible : entreprise introuvable ou service pas encore à jour.")
  assert.equal(companyErrorMessage(new ApiError(400, "id d'entreprise invalide")), "Entreprise introuvable ou informations indisponibles.")
  assert.equal(companyErrorMessage(new ApiError(404, "entreprise introuvable")), "Entreprise introuvable ou informations indisponibles.")
})

// ── Proxy : binaire et Content-Disposition relayés ────────────────────────────

test("proxy : fichier binaire relayé à l'identique avec Content-Type et Content-Disposition", async () => {
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x80, 0x0a, 0x0d])
  const disposition = 'attachment; filename="releve-acme-2026-11-01_2026-11-30.xlsx"'
  const calls = mockFetch(() =>
    new Response(bytes, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": disposition,
      },
    }),
  )
  const req = new NextRequest("http://localhost:3000/api/proxy/b2b/bookings-report.xlsx?from=2026-11-01&to=2026-11-30&status=all", {
    headers: { cookie: "access_token=jwt" },
  })
  const res = await proxyGet(req, { params: Promise.resolve({ path: ["b2b", "bookings-report.xlsx"] }) })
  assert.match(calls[0].url, /\/b2b\/bookings-report\.xlsx\?from=2026-11-01&to=2026-11-30&status=all$/)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  assert.equal(res.headers.get("content-disposition"), disposition)
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), bytes)
})
