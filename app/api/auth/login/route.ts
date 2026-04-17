import { NextRequest, NextResponse } from "next/server"

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL

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

  const response = NextResponse.json({ ok: true })

  // access_token stocké en cookie lisible par JS (non-httpOnly) pour que
  // apiFetch côté client puisse l'injecter dans l'Authorization header.
  // La sensibilité est limitée : TTL court, refresh_token reste httpOnly.
  response.cookies.set("access_token", data.access_token, {
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
