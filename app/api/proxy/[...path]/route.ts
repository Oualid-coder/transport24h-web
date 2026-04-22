import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// URL interne du backend — variable serveur uniquement (non exposée au client)
const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")

type RouteContext = { params: Promise<{ path: string[] }> }

async function proxyRequest(
  req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { path } = await params
  // Reconstruit le chemin + query string d'origine
  const search = req.nextUrl.search
  const target = `${API_URL}/${path.join("/")}${search}`

  // Lit le token depuis le cookie httpOnly — inaccessible côté client
  const cookieStore = await cookies()
  const token = cookieStore.get("access_token")?.value

  const forwardHeaders: Record<string, string> = {}
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

  return response
}

export const GET    = proxyRequest
export const POST   = proxyRequest
export const PUT    = proxyRequest
export const PATCH  = proxyRequest
export const DELETE = proxyRequest
