import { NextRequest, NextResponse } from "next/server"

const PROTECTED_PREFIXES = ["/admin", "/driver", "/dashboard", "/booking"]

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  )

  if (!isProtected) return NextResponse.next()

  const token = request.cookies.get("access_token")?.value
  if (!token) {
    // access_token expiré ou absent : le cookie refresh_token (Path=/api/auth) n'est pas visible ici.
    // /session tente le renouvellement côté navigateur, puis revient ici ou envoie vers /login (audit M5).
    const sessionUrl = new URL("/session", request.url)
    sessionUrl.searchParams.set("redirect", pathname + request.nextUrl.search)
    return NextResponse.redirect(sessionUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/driver/:path*", "/dashboard/:path*", "/booking/:path*"],
}
