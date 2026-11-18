import { NextRequest, NextResponse } from "next/server"
import { buildCsp, generateNonce } from "@/lib/csp"

const PROTECTED_PREFIXES = ["/admin", "/driver", "/dashboard", "/booking"]

// Préfixe exact (segment entier) : /bookingx n'est pas protégé, comme avec l'ancien matcher.
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  )
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  if (isProtectedPath(pathname) && !request.cookies.get("access_token")?.value) {
    // access_token expiré ou absent : le cookie refresh_token (Path=/api/auth) n'est pas visible ici.
    // /session tente le renouvellement côté navigateur, puis revient ici ou envoie vers /login (audit M5).
    const sessionUrl = new URL("/session", request.url)
    sessionUrl.searchParams.set("redirect", pathname + request.nextUrl.search)
    return NextResponse.redirect(sessionUrl)
  }

  // CSP à nonce (audit M8) : Next.js lit le nonce dans l'en-tête CSP de la requête et l'applique
  // à ses scripts ; le navigateur reçoit la même politique sur la réponse.
  const nonce = generateNonce()
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development")
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("Content-Security-Policy", csp)
  return response
}

export const config = {
  // Toutes les pages (CSP), hors routes API, fichiers statiques et optimisation d'images.
  // Pas d'exclusion des préchargements (next-router-prefetch) : ils doivent rester soumis
  // à la redirection des pages protégées.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
