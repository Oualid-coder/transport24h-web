import { NextRequest, NextResponse } from "next/server"

const PROTECTED_PREFIXES = ["/admin", "/driver", "/dashboard"]

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  )

  if (!isProtected) return NextResponse.next()

  const token = request.cookies.get("access_token")?.value
  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/driver/:path*", "/dashboard/:path*"],
}
