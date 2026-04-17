import { NextRequest, NextResponse } from "next/server"

// Proxy vers OSRM — le browser ne doit jamais appeler OSRM directement.
// OSRM tourne sur localhost (ou réseau interne), inaccessible depuis le client.

const OSRM_URL = process.env.OSRM_URL ?? "http://localhost:5001"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const fromLat = sp.get("from_lat")
  const fromLng = sp.get("from_lng")
  const toLat = sp.get("to_lat")
  const toLng = sp.get("to_lng")

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return NextResponse.json(
      { error: "Paramètres requis : from_lat, from_lng, to_lat, to_lng" },
      { status: 400 },
    )
  }

  const url =
    `${OSRM_URL}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=full&geometries=geojson`

  try {
    const res = await fetch(url, {
      // Cache 5 minutes — les itinéraires changent rarement
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: "OSRM indisponible" },
        { status: 502 },
      )
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: "Impossible de calculer l'itinéraire" },
      { status: 502 },
    )
  }
}
