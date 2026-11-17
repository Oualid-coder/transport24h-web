// Paramètres de /api/route (proxy OSRM public) : exactement deux points, coordonnées décimales bornées.
// Rien de la requête n'est recopié tel quel dans l'URL OSRM : seuls les nombres validés le sont.
export type RoutePoints = { fromLat: number; fromLng: number; toLat: number; toLng: number }

const KEYS = ["from_lat", "from_lng", "to_lat", "to_lng"] as const
// Décimal simple ou notation exponentielle de Number#toString (ex. 1e-7)
const NUMBER_FORMAT = /^-?\d{1,3}(\.\d{1,20})?(e-\d{1,3})?$/i

function coordinate(raw: string, max: number): number | null {
  if (raw.length > 32 || !NUMBER_FORMAT.test(raw)) return null
  const n = Number(raw)
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null
}

export function parseRouteParams(sp: URLSearchParams): RoutePoints | null {
  // Paramètres inconnus ou répétés : refus (évite tout point supplémentaire)
  for (const key of sp.keys()) if (!(KEYS as readonly string[]).includes(key)) return null
  const values: number[] = []
  for (const key of KEYS) {
    const all = sp.getAll(key)
    if (all.length !== 1) return null
    const n = coordinate(all[0], key.endsWith("_lat") ? 90 : 180)
    if (n === null) return null
    values.push(n)
  }
  const [fromLat, fromLng, toLat, toLng] = values
  return { fromLat, fromLng, toLat, toLng }
}

export function osrmRoutePath(p: RoutePoints): string {
  return `/route/v1/driving/${p.fromLng},${p.fromLat};${p.toLng},${p.toLat}?overview=full&geometries=geojson`
}
