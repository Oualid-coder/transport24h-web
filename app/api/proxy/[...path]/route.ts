import { NextRequest, NextResponse } from "next/server"
import { clientIpHeaders } from "@/lib/client-ip"
import { isCrossOriginMutation, proxyPath } from "@/lib/request-guard"

// URL interne du backend — variable serveur uniquement (non exposée au client)
const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")

type RouteContext = { params: Promise<{ path: string[] }> }

async function proxyRequest(
  req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  // Requête modifiante venue d'un autre site (CSRF) : refusée avant tout appel
  if (isCrossOriginMutation(req)) {
    return NextResponse.json({ error: "Requête refusée" }, { status: 403 })
  }

  const { path } = await params
  // Reconstruit le chemin (segments ré-encodés) + query string d'origine
  const safePath = proxyPath(path)
  if (safePath === null) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 })
  }
  const search = req.nextUrl.search
  const target = `${API_URL}/${safePath}${search}`

  // Lit le token depuis le cookie httpOnly — inaccessible côté client
  const token = req.cookies.get("access_token")?.value

  // IP du visiteur (limitation de débit par IP à la gateway)
  const forwardHeaders: Record<string, string> = clientIpHeaders(req.headers)
  const ct = req.headers.get("content-type")
  if (ct) forwardHeaders["content-type"] = ct
  if (token) forwardHeaders["authorization"] = `Bearer ${token}`

  // GET et HEAD n'ont pas de body
  const rawBody =
    req.method !== "GET" && req.method !== "HEAD"
      ? await req.arrayBuffer()
      : undefined
  const body = rawBody && rawBody.byteLength > 0 ? rawBody : undefined

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: forwardHeaders,
      body,
    })
  } catch {
    return NextResponse.json({ error: "Backend inaccessible" }, { status: 502 })
  }

  // Retransmet le status + body du backend sans transformation
  const responseBody = await upstream.arrayBuffer()
  const response = new NextResponse(
    responseBody.byteLength > 0 ? responseBody : null,
    { status: upstream.status },
  )
  const responseCt = upstream.headers.get("content-type")
  if (responseCt) response.headers.set("content-type", responseCt)
  // Délai d'attente des 429 (renvoi du mail de vérification, limites de la gateway)
  const retryAfter = upstream.headers.get("retry-after")
  if (retryAfter) response.headers.set("retry-after", retryAfter)

  return response
}

export const GET    = proxyRequest
export const POST   = proxyRequest
export const PUT    = proxyRequest
export const PATCH  = proxyRequest
export const DELETE = proxyRequest
