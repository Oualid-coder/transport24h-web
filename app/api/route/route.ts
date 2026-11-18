import { NextRequest, NextResponse } from "next/server"
import { osrmRoutePath, parseRouteParams } from "@/lib/route-params"

// Proxy vers OSRM — le browser ne doit jamais appeler OSRM directement.
// OSRM tourne sur localhost (ou réseau interne), inaccessible depuis le client.

const OSRM_URL = process.env.OSRM_URL ?? "http://localhost:5001"

export async function GET(request: NextRequest) {
  const points = parseRouteParams(request.nextUrl.searchParams)
  if (!points) {
    return NextResponse.json(
      {
        error:
          "Paramètres requis : from_lat, from_lng, to_lat, to_lng (nombres décimaux, latitude ±90, longitude ±180)",
      },
      { status: 400 },
    )
  }

  const url = `${OSRM_URL}${osrmRoutePath(points)}`

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
