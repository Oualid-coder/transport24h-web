import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@/lib/types"

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL

// Décode le payload d'un JWT sans vérifier la signature.
// La vérification a déjà été faite par le backend Go — on lit juste le rôle.
function decodeJWTClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf-8")
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function redirectForRole(role: string): string {
  switch (role) {
    case "admin":  return "/admin/dashboard"
    case "driver": return "/driver/dashboard"
    default:       return "/dashboard"
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 })
  }

  // Extrait le param de redirection client — ne le transmet pas au backend Go
  const clientRedirect =
    typeof body.redirect === "string" && body.redirect.startsWith("/")
      ? body.redirect
      : null

  let backendRes: Response
  try {
    backendRes = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const claims = decodeJWTClaims(data.access_token)
  const role = (typeof claims?.role === "string" ? claims.role : "client") as UserRole

  // Le ?redirect= client prend la priorité sur la redirection par rôle
  const destination = clientRedirect ?? redirectForRole(role)

  // Retourne un 302 avec les cookies déjà posés — le browser traite Set-Cookie
  // avant de suivre la redirection, donc proxy.ts voit le cookie sur la prochaine requête.
  const response = NextResponse.redirect(new URL(destination, request.url))

  // access_token httpOnly — lu par le Route Handler proxy et le middleware proxy.ts
  response.cookies.set("access_token", data.access_token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: data.expires_in,
  })

  // user_role — non-httpOnly, lu par les layouts Server Component pour la navbar
  response.cookies.set("user_role", role, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: data.expires_in,
  })

  // Forwarde le refresh_token httpOnly posé par Go
  const goSetCookie = backendRes.headers.get("set-cookie")
  if (goSetCookie?.includes("refresh_token")) {
    response.headers.append("set-cookie", goSetCookie)
  }

  return response
}
