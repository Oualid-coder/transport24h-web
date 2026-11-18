import { NextRequest, NextResponse } from "next/server"
import { safeRedirectPath } from "@/lib/safe-redirect"
import { clientIpHeaders } from "@/lib/client-ip"
import { isCrossOriginMutation, isJsonContentType } from "@/lib/request-guard"
import { refreshFromSetCookie, roleFromAccessToken, setSessionCookies } from "@/lib/session-cookies"

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL

function redirectForRole(role: string): string {
  switch (role) {
    case "admin":  return "/admin/dashboard"
    case "driver": return "/driver/dashboard"
    default:       return "/dashboard"
  }
}

export async function POST(request: NextRequest) {
  // Login CSRF : origine étrangère refusée, et corps JSON exigé (un formulaire ne peut pas l'envoyer)
  if (isCrossOriginMutation(request)) {
    return NextResponse.json({ error: "Requête refusée" }, { status: 403 })
  }
  if (!isJsonContentType(request)) {
    return NextResponse.json({ error: "Type de contenu non pris en charge" }, { status: 415 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 })
  }

  // Extrait le param de redirection client — ne le transmet pas au backend Go
  // Chemin interne uniquement (pas de "//hôte", "/\hôte" ni d'URL absolue) : sinon redirection par rôle
  const clientRedirect = safeRedirectPath(body.redirect)

  let backendRes: Response
  try {
    backendRes = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      // IP du visiteur : la limite de tentatives de connexion est comptée par IP à la gateway
      headers: { "Content-Type": "application/json", ...clientIpHeaders(request.headers) },
      body: JSON.stringify({ email: body.email, password: body.password }),
    })
  } catch {
    return NextResponse.json({ error: "Backend inaccessible" }, { status: 502 })
  }

  if (!backendRes.ok) {
    const data = (await backendRes.json().catch(() => ({}))) as { error?: string }
    return NextResponse.json(
      { error: data.error ?? "Identifiants invalides" },
      { status: backendRes.status },
    )
  }

  const data = (await backendRes.json()) as { access_token: string; expires_in: number }

  const role = roleFromAccessToken(data.access_token)

  // Le ?redirect= client prend la priorité sur la redirection par rôle
  const destination = clientRedirect ?? redirectForRole(role)

  // Retourne 200 JSON — le client lit redirect_to et fait router.push(path).
  // Un 302 ferait suivre le redirect à fetch(), exposant l'origine interne du
  // conteneur (0.0.0.0:3000) au lieu du domaine public → violation CSP connect-src.
  const response = NextResponse.json({ redirect_to: destination })

  // access_token, user_role, et refresh_token reposé en Path=/api/auth (le Path=/auth de l'API n'atteint
  // aucune route du site) : utilisé par /api/auth/refresh et révoqué par /api/auth/logout (audit M5)
  setSessionCookies(response, data.access_token, data.expires_in, refreshFromSetCookie(backendRes.headers))

  return response
}
