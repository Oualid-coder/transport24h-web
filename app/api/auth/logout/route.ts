import { NextRequest, NextResponse } from "next/server"
import { clientIpHeaders } from "@/lib/client-ip"
import { isCrossOriginMutation } from "@/lib/request-guard"
import { clearSessionCookies, REFRESH_COOKIE } from "@/lib/session-cookies"

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL

export async function POST(request: NextRequest) {
  // Déconnexion forcée depuis un autre site : refusée
  if (isCrossOriginMutation(request)) {
    return NextResponse.json({ error: "Requête refusée" }, { status: 403 })
  }

  // Révocation du refresh token à l'API (POST /auth/logout lit le cookie, 204). Erreur ignorée :
  // les cookies sont effacés dans tous les cas. Les sessions ouvertes avant le correctif M5
  // (cookie en Path=/auth, jamais envoyé ici) ne peuvent pas être révoquées.
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  if (refreshToken) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { Cookie: `${REFRESH_COOKIE}=${refreshToken}`, ...clientIpHeaders(request.headers) },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      // API injoignable : déconnexion locale quand même
    }
  }

  const response = NextResponse.json({ ok: true })
  clearSessionCookies(response)
  return response
}
