import { NextRequest, NextResponse } from "next/server"
import { clientIpHeaders } from "@/lib/client-ip"
import { isCrossOriginMutation } from "@/lib/request-guard"
import { clearSessionCookies, REFRESH_COOKIE, refreshFromSetCookie, setSessionCookies } from "@/lib/session-cookies"

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL

// POST /api/auth/refresh : renouvelle access_token avec le cookie refresh_token (Path=/api/auth).
// L'API lit le refresh token dans l'en-tête Cookie uniquement et renvoie { access_token, expires_in }.
// 401 (absent, invalide, expiré, révoqué) et 403 (compte désactivé) : cookies effacés. 429, 5xx et
// réseau : statut relayé, cookies gardés (erreur passagère).
export async function POST(request: NextRequest) {
  if (isCrossOriginMutation(request)) {
    return NextResponse.json({ error: "Requête refusée" }, { status: 403 })
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  if (!refreshToken) {
    const response = NextResponse.json({ error: "Session expirée" }, { status: 401 })
    clearSessionCookies(response)
    return response
  }

  let backendRes: Response
  try {
    backendRes = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      // Jeton JWT (base64url et points) : aucun caractère à échapper dans l'en-tête Cookie
      headers: { Cookie: `${REFRESH_COOKIE}=${refreshToken}`, ...clientIpHeaders(request.headers) },
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ error: "Backend inaccessible" }, { status: 502 })
  }

  if (!backendRes.ok) {
    const status = backendRes.status
    const response = NextResponse.json({ error: "Session expirée" }, { status })
    if (status === 401 || status === 403) clearSessionCookies(response)
    const retryAfter = backendRes.headers.get("retry-after")
    if (retryAfter) response.headers.set("retry-after", retryAfter)
    return response
  }

  const data = (await backendRes.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null
  if (typeof data?.access_token !== "string" || typeof data.expires_in !== "number") {
    return NextResponse.json({ error: "Réponse invalide" }, { status: 502 })
  }

  const response = NextResponse.json({ ok: true })
  // Refresh reposé seulement si l'API le fait tourner (pas le cas aujourd'hui : aucun Set-Cookie sur 200)
  setSessionCookies(response, data.access_token, data.expires_in, refreshFromSetCookie(backendRes.headers))
  return response
}
