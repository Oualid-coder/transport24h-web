import { NextRequest, NextResponse } from "next/server"
import { clientIpHeaders } from "@/lib/client-ip"
import { isCrossOriginMutation, isJsonContentType } from "@/lib/request-guard"
import { clearSessionCookies, refreshFromSetCookie, setSessionCookies } from "@/lib/session-cookies"

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL

// POST /api/auth/change-password : { current_password, new_password } relayés à l'API avec
// l'access_token (cookie httpOnly). L'API révoque toutes les sessions du compte et en émet une
// nouvelle : { access_token, expires_in } + Set-Cookie refresh_token, reposés ici comme au login.
// Erreurs relayées telles quelles (401 : le client renouvelle puis rejoue ; 403, 409, 422, 429 avec
// Retry-After). Corps jamais journalisé.
export async function POST(request: NextRequest) {
  if (isCrossOriginMutation(request)) {
    return NextResponse.json({ error: "Requête refusée" }, { status: 403 })
  }
  if (!isJsonContentType(request)) {
    return NextResponse.json({ error: "Type de contenu non pris en charge" }, { status: 415 })
  }

  const token = request.cookies.get("access_token")?.value
  if (!token) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 })
  }

  let backendRes: Response
  try {
    backendRes = await fetch(`${API_URL}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...clientIpHeaders(request.headers),
      },
      // Seuls les deux champs attendus partent vers l'API
      body: JSON.stringify({ current_password: body.current_password, new_password: body.new_password }),
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ error: "Service momentanément indisponible" }, { status: 502 })
  }

  if (!backendRes.ok) {
    const data = (await backendRes.json().catch(() => ({}))) as { error?: string }
    const response = NextResponse.json(
      { error: data.error ?? "Changement impossible" },
      { status: backendRes.status },
    )
    const retryAfter = backendRes.headers.get("retry-after")
    if (retryAfter) response.headers.set("retry-after", retryAfter)
    return response
  }

  const data = (await backendRes.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null
  // Mot de passe changé : nouvelle session posée si l'API l'a émise. Sinon ({relogin: true} de
  // l'API, ou réponse illisible) : toutes les sessions sont déjà révoquées côté API, les cookies
  // sont effacés et le client renvoie vers la connexion.
  if (typeof data?.access_token === "string" && typeof data.expires_in === "number" && data.expires_in > 0) {
    const response = NextResponse.json({ ok: true, relogin: false })
    setSessionCookies(response, data.access_token, data.expires_in, refreshFromSetCookie(backendRes.headers))
    return response
  }
  const response = NextResponse.json({ ok: true, relogin: true })
  clearSessionCookies(response)
  return response
}
