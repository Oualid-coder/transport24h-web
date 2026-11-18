"use client"

// Page de reprise de session (audit M5). proxy.ts y envoie toute page protégée demandée sans access_token :
// le cookie refresh_token (Path=/api/auth) n'est lisible que par /api/auth/refresh. Un essai, puis navigation
// complète vers la page demandée (succès) ou vers /login (session refusée). Gardes anti-boucle : cookie
// user_role vérifié après succès (resumeSession), et date du dernier succès dans sessionStorage.
// 429 / service indisponible : message, bouton « Réessayer », au plus un nouvel essai automatique.
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { resumeSession, type ResumeResult } from "@/lib/api"

const ATTEMPT_KEY = "session-resume-at"
const ATTEMPT_WINDOW_MS = 15_000
// Nouvel essai automatique : un seul, et seulement si Retry-After ne dépasse pas ce délai
const AUTO_RETRY_MAX_S = 60

function readRecentAttempt(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(ATTEMPT_KEY))
    return at > 0 && Date.now() - at < ATTEMPT_WINDOW_MS
  } catch {
    return false
  }
}

function markAttempt(): void {
  try {
    window.sessionStorage.setItem(ATTEMPT_KEY, String(Date.now()))
  } catch {
    // stockage bloqué : la garde du cookie user_role (resumeSession) reste active
  }
}

type State = { kind: "pending" } | { kind: "retry"; message: string; loginUrl: string; retryAfter: number | null }

function Pending() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
      Reprise de votre session…
    </div>
  )
}

function SessionContent() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect")
  const [state, setState] = useState<State>({ kind: "pending" })
  const started = useRef(false)
  const autoRetried = useRef(false)

  // Résultat d'un essai : navigation complète, ou message (429 / indisponible)
  const apply = useCallback((result: ResumeResult) => {
    if (result.kind === "navigate") {
      if (!result.to.startsWith("/login")) markAttempt()
      window.location.replace(result.to)
      return
    }
    setState({ kind: "retry", message: result.message, loginUrl: result.loginUrl, retryAfter: result.retryAfter })
  }, [])

  const retry = useCallback(() => {
    setState({ kind: "pending" })
    void resumeSession(redirect, readRecentAttempt()).then(apply)
  }, [redirect, apply])

  useEffect(() => {
    // Un seul essai au chargement (état initial « pending »), même si l'effet est rejoué (mode strict)
    if (started.current) return
    started.current = true
    void resumeSession(redirect, readRecentAttempt()).then(apply)
  }, [redirect, apply])

  // Un seul nouvel essai automatique, après Retry-After (plafonné) ; ensuite seulement le bouton
  useEffect(() => {
    if (state.kind !== "retry" || autoRetried.current) return
    const delay = state.retryAfter
    if (delay === null || delay <= 0 || delay > AUTO_RETRY_MAX_S) return
    const timer = window.setTimeout(() => {
      autoRetried.current = true
      retry()
    }, delay * 1000)
    return () => window.clearTimeout(timer)
  }, [state, retry])

  if (state.kind === "pending") return <Pending />
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <AlertCircle className="mx-auto mb-4 size-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Reprise de session impossible pour l&apos;instant</h1>
      <p className="mt-2 text-muted-foreground" role="status">{state.message}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button onClick={retry}>Réessayer</Button>
        <Link href={state.loginUrl} className={buttonVariants({ variant: "outline" })}>
          Se reconnecter
        </Link>
      </div>
    </div>
  )
}

export default function SessionPage() {
  return (
    <Suspense fallback={<Pending />}>
      <SessionContent />
    </Suspense>
  )
}
