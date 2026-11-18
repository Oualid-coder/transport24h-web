import { NextRequest, NextResponse } from "next/server"
import { isCrossOriginMutation } from "@/lib/request-guard"

export async function POST(request: NextRequest) {
  // Déconnexion forcée depuis un autre site : refusée
  if (isCrossOriginMutation(request)) {
    return NextResponse.json({ error: "Requête refusée" }, { status: 403 })
  }
  const response = NextResponse.json({ ok: true })
  response.cookies.set("access_token", "", { path: "/", maxAge: 0 })
  response.cookies.set("user_role", "", { path: "/", maxAge: 0 })
  response.cookies.set("refresh_token", "", { path: "/auth", maxAge: 0 })
  return response
}
