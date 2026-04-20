import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set("access_token", "", { path: "/", maxAge: 0 })
  response.cookies.set("user_role", "", { path: "/", maxAge: 0 })
  response.cookies.set("refresh_token", "", { path: "/auth", maxAge: 0 })
  return response
}
