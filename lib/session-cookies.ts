import type { NextResponse } from "next/server"
import type { UserRole } from "@/lib/types"

// Cookies de session du site (audit M5). Contrat API (internal/handler/auth.go) :
// - POST /auth/login : { access_token, expires_in } + Set-Cookie refresh_token (Path=/auth, 7 j, HttpOnly,
//   SameSite=Strict) ; POST /auth/refresh lit refresh_token dans l'en-tête Cookie uniquement (jamais le corps),
//   renvoie { access_token, expires_in } sans faire tourner le refresh ; 401 absent/invalide/révoqué, 403 désactivé.
// - POST /auth/logout : lit le même cookie, le révoque (liste noire Redis), 204.
// Le cookie refresh est reposé sur le domaine web en Path=/api/auth : envoyé seulement aux Route Handlers
// /api/auth/* (refresh, logout, login), jamais aux pages ni au proxy.

export const REFRESH_COOKIE = "refresh_token"
export const REFRESH_COOKIE_PATH = "/api/auth"
// Chemin des sessions ouvertes avant ce correctif (copie brute du cookie de l'API) : effacé au logout
export const LEGACY_REFRESH_COOKIE_PATH = "/auth"
// Durée du refresh token côté API (refreshTokenMaxAge = 7 * 24 h), utilisée si Max-Age est illisible
export const REFRESH_MAX_AGE_FALLBACK = 7 * 24 * 60 * 60

const secure = () => process.env.NODE_ENV === "production"

// Décode le payload d'un JWT sans vérifier la signature.
// La vérification a déjà été faite par le backend Go — on lit juste le rôle.
export function decodeJWTClaims(token: string): Record<string, unknown> | null {
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

export function roleFromAccessToken(token: string): UserRole {
  const claims = decodeJWTClaims(token)
  // Valeur lue dans un JWT signé par l'API : "client" par défaut si absente
  return (typeof claims?.role === "string" ? claims.role : "client") as UserRole
}

// Refresh token posé par l'API (Set-Cookie) : valeur et durée. null si absent ou vide (effacement).
export function refreshFromSetCookie(headers: Headers): { value: string; maxAge: number } | null {
  for (const line of headers.getSetCookie()) {
    const [pair, ...attrs] = line.split(";")
    const eq = pair.indexOf("=")
    if (eq < 0 || pair.slice(0, eq).trim() !== REFRESH_COOKIE) continue
    const value = pair.slice(eq + 1).trim()
    if (value === "") return null
    let maxAge = REFRESH_MAX_AGE_FALLBACK
    for (const attr of attrs) {
      const [k, v] = attr.split("=")
      if (k.trim().toLowerCase() === "max-age" && /^\d+$/.test(v?.trim() ?? "")) maxAge = Number(v.trim())
    }
    return maxAge > 0 ? { value, maxAge } : null
  }
  return null
}

// access_token (httpOnly, lu par le proxy et proxy.ts) et user_role (lu par les layouts pour la navbar),
// plus le refresh token si l'API en fournit un.
export function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  expiresIn: number,
  refresh: { value: string; maxAge: number } | null,
): void {
  const role = roleFromAccessToken(accessToken)
  response.cookies.set("access_token", accessToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: secure(),
    maxAge: expiresIn,
  })
  response.cookies.set("user_role", role, {
    path: "/",
    sameSite: "lax",
    secure: secure(),
    maxAge: expiresIn,
  })
  if (refresh) {
    // Strict : appelé seulement en fetch même origine (refresh, logout), jamais par une navigation
    response.cookies.set(REFRESH_COOKIE, refresh.value, {
      httpOnly: true,
      path: REFRESH_COOKIE_PATH,
      sameSite: "strict",
      secure: secure(),
      maxAge: refresh.maxAge,
    })
  }
}

// Efface tous les cookies de session, y compris l'ancien refresh en Path=/auth.
// response.cookies est indexé par nom : le second refresh_token est ajouté en en-tête brut, en dernier.
export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set("access_token", "", { path: "/", maxAge: 0 })
  response.cookies.set("user_role", "", { path: "/", maxAge: 0 })
  response.cookies.set(REFRESH_COOKIE, "", { path: REFRESH_COOKIE_PATH, maxAge: 0, httpOnly: true, sameSite: "strict", secure: secure() })
  response.headers.append(
    "set-cookie",
    `${REFRESH_COOKIE}=; Path=${LEGACY_REFRESH_COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Strict${secure() ? "; Secure" : ""}`,
  )
}
