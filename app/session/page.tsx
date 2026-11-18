"use client"

// Page de reprise de session (audit M5). proxy.ts y envoie toute page protégée demandée sans access_token :
// le cookie refresh_token (Path=/api/auth) n'est lisible que par /api/auth/refresh. Un seul essai, puis
// navigation complète vers la page demandée (succès) ou vers /login (échec). Si la page demandée renvoie
// ici juste après un succès (cookie non enregistré), connexion directe : jamais de boucle.
import { Suspense, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { resumeSession } from "@/lib/api"

// Garde anti-boucle par onglet : date du dernier renouvellement réussi (stockage indisponible : ignoré)
const ATTEMPT_KEY = "session-resume-at"
const ATTEMPT_WINDOW_MS = 15_000

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
    // stockage bloqué : pas de garde, la limite de la gateway (10 refresh/min par IP) borne la boucle
  }
}

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
  // Un seul essai, même si l'effet est rejoué (mode strict)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void resumeSession(redirect, readRecentAttempt()).then((target) => {
      if (!target.startsWith("/login")) markAttempt()
      window.location.replace(target)
    })
  }, [redirect])

  return <Pending />
}

export default function SessionPage() {
  return (
    <Suspense fallback={<Pending />}>
      <SessionContent />
    </Suspense>
  )
}
