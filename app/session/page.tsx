"use client"

// Page de reprise de session (audit M5). proxy.ts y envoie toute page protégée demandée sans access_token :
// le cookie refresh_token (Path=/api/auth) n'est lisible que par /api/auth/refresh. Un essai, puis navigation
// complète vers la page demandée (succès) ou vers /login (session refusée). Gardes anti-boucle : cookie
// user_role vérifié après succès (resumeSession), et retours récents notés dans sessionStorage et dans un
// cookie de courte durée (lib/session-resume.ts, sujet 54) : au-delà, arrêt ici avec « Se connecter ».
// 429 / service indisponible : message, bouton « Réessayer », au plus un nouvel essai automatique.
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { resumeSession, type ResumeResult } from "@/lib/api"
import { browserGuardEnv, recordResume, resumeLimitReached, STOPPED_MESSAGE, STOPPED_TITLE } from "@/lib/session-resume"

// Nouvel essai automatique : un seul, et seulement si Retry-After ne dépasse pas ce délai
const AUTO_RETRY_MAX_S = 60

const readRecentAttempt = (): boolean => resumeLimitReached(browserGuardEnv())

type State =
  | { kind: "pending" }
  | { kind: "retry"; message: string; loginUrl: string; retryAfter: number | null; manualOnly: boolean }
  | { kind: "stopped"; loginUrl: string }

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
  const stoppedTitle = useRef<HTMLHeadingElement>(null)

  // Résultat d'un essai : navigation complète, ou message (429 / indisponible)
  const apply = useCallback((result: ResumeResult) => {
    if (result.kind === "navigate") {
      // Retour vers une page protégée seulement s'il a pu être noté (sinon, boucle possible) : arrêt
      if (!result.to.startsWith("/login") && !recordResume(browserGuardEnv())) {
        setState({ kind: "stopped", loginUrl: `/login?redirect=${encodeURIComponent(result.to)}` })
        return
      }
      window.location.replace(result.to)
      return
    }
    if (result.kind === "stopped") {
      setState(result)
      return
    }
    setState({
      kind: "retry",
      message: result.message,
      loginUrl: result.loginUrl,
      retryAfter: result.retryAfter,
      manualOnly: autoRetried.current,
    })
  }, [])

  const retry = useCallback(() => {
    // Après un essai (manuel ou automatique), plus aucun essai automatique : le bouton seul
    autoRetried.current = true
    setState({ kind: "pending" })
    void resumeSession(redirect, readRecentAttempt()).then(apply)
  }, [redirect, apply])

  // Après un arrêt : un essai manuel, sans les gardes (un clic par aller-retour, jamais de boucle)
  const retryStopped = useCallback(() => {
    setState({ kind: "pending" })
    void resumeSession(redirect, false).then(apply)
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
      retry()
    }, delay * 1000)
    return () => window.clearTimeout(timer)
  }, [state, retry])

  // Arrêt : focus sur le titre, pour que le message soit lu au clavier et au lecteur d'écran
  useEffect(() => {
    if (state.kind === "stopped") stoppedTitle.current?.focus()
  }, [state])

  if (state.kind === "pending") return <Pending />
  if (state.kind === "stopped") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <AlertCircle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 ref={stoppedTitle} tabIndex={-1} className="text-2xl font-bold outline-none">
          {STOPPED_TITLE}
        </h1>
        <p className="mt-2 text-muted-foreground" role="alert">
          {STOPPED_MESSAGE}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={state.loginUrl} className={buttonVariants()}>
            Se connecter
          </Link>
          <Button variant="outline" onClick={retryStopped}>
            Réessayer
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <AlertCircle className="mx-auto mb-4 size-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Reprise de session impossible pour l&apos;instant</h1>
      <p className="mt-2 text-muted-foreground" role="status">
        {state.message}
        {state.manualOnly ? " Utilisez le bouton « Réessayer » quand vous êtes prêt." : ""}
      </p>
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
