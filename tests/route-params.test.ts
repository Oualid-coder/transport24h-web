// /api/route (proxy OSRM public) : validation des paramètres
import { test } from "node:test"
import assert from "node:assert/strict"
import { osrmRoutePath, parseRouteParams } from "../lib/route-params"

const ok = { from_lat: "48.8566", from_lng: "2.3522", to_lat: "45.764", to_lng: "4.8357" }
const qs = (o: Record<string, string>) => new URLSearchParams(o)

test("route : coordonnées valides → chemin OSRM construit depuis les nombres", () => {
  const p = parseRouteParams(qs(ok))
  assert.deepEqual(p, { fromLat: 48.8566, fromLng: 2.3522, toLat: 45.764, toLng: 4.8357 })
  assert.equal(osrmRoutePath(p!), "/route/v1/driving/2.3522,48.8566;4.8357,45.764?overview=full&geometries=geojson")
  assert.ok(parseRouteParams(qs({ ...ok, from_lat: "-90", to_lng: "180" })))
  assert.ok(parseRouteParams(qs({ ...ok, from_lat: "1e-7" }))) // format de Number#toString
})

test("route : paramètres invalides → refus", () => {
  const bad: Array<Record<string, string>> = [
    { ...ok, from_lat: "1/../x" },
    { ...ok, from_lat: "abc" },
    { ...ok, from_lat: "91" },
    { ...ok, from_lat: "-90.0001" },
    { ...ok, to_lng: "180.5" },
    { ...ok, to_lng: "" },
    { ...ok, to_lng: "0x10" },
    { ...ok, to_lng: "Infinity" },
    { ...ok, to_lng: "NaN" },
    { ...ok, to_lng: " 2.3" },
    { ...ok, to_lng: "2.3;4.5,6.7" },
    { ...ok, to_lng: "2.3?x=1" },
    { ...ok, to_lng: "1".repeat(40) },
    { from_lat: "48.8", from_lng: "2.3", to_lat: "45.7" },
    { ...ok, extra: "1" },
  ]
  for (const b of bad) assert.equal(parseRouteParams(qs(b)), null, JSON.stringify(b))
  // Point en double (paramètre répété)
  const dup = qs(ok)
  dup.append("to_lat", "40")
  assert.equal(parseRouteParams(dup), null)
})

test("route : coordonnée en pleine précision proche de 0 acceptée", () => {
  const v = String(0.000012345678901234567) // 21 décimales
  const sp = new URLSearchParams({ from_lat: v, from_lng: "2.35", to_lat: "48.85", to_lng: `-${v}` })
  assert.notEqual(parseRouteParams(sp), null)
})
