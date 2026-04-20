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
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 })
  }

  let backendRes: Response
  try {
    backendRes = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    return NextResponse.json({ error: "Backend inaccessible" }, { status: 502 })
  }

  if (!backendRes.ok) {
    const data = await backendRes.json().catch(() => ({})) as { error?: string }
    return NextResponse.json(
      { error: data.error ?? "Identifiants invalides" },
      { status: backendRes.status },
    )
  }

  const data = await backendRes.json() as { access_token: string; expires_in: number }

  // Extraire le rôle depuis les claims JWT
  const claims = decodeJWTClaims(data.access_token)
  const role = (typeof claims?.role === "string" ? claims.role : "client") as UserRole
  const redirectTo = redirectForRole(role)

  const response = NextResponse.json({ ok: true, redirect_to: redirectTo })

  // access_token — non-httpOnly pour que apiFetch client puisse injecter le header
  response.cookies.set("access_token", data.access_token, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: data.expires_in,
  })

  // user_role — non-httpOnly pour que la navbar server puisse lire le rôle
  response.cookies.set("user_role", role, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: data.expires_in,
  })

  // Forwarde le refresh_token httpOnly que Go a positionné
  const goSetCookie = backendRes.headers.get("set-cookie")
  if (goSetCookie?.includes("refresh_token")) {
    response.headers.append("set-cookie", goSetCookie)
  }

  return response
}
