// Garde anti-boucle de la page /session (sujet 54) : /session ne renvoie vers la page protégée qu'après
// avoir noté ce retour, et s'arrête (message + « Se connecter ») si des retours récents ont déjà eu lieu.
// - sessionStorage["session-resume-at"] : un retour par onglet en 15 s (comme avant) ;
// - cookie session_resume (non httpOnly, Path=/session, 60 s glissantes), écrit seulement si le stockage
//   est bloqué (il lève, ou est absent) : au plus RESUME_LIMIT retours par navigateur.
// Si aucun des deux ne peut être noté, pas de retour automatique (arrêt) : la boucle est impossible.
// Le cookie ne contient qu'un compteur : jamais d'URL (aucune redirection ouverte possible).

export const ATTEMPT_KEY = "session-resume-at"
export const ATTEMPT_WINDOW_MS = 15_000
export const RESUME_COOKIE = "session_resume"
export const RESUME_COOKIE_MAX_AGE_S = 60
// Plusieurs onglets restaurés en même temps reprennent chacun la session : quelques retours tolérés
export const RESUME_LIMIT = 3

export const STOPPED_TITLE = "Reprise de session interrompue"
export const STOPPED_MESSAGE =
  "Votre session n'a pas pu être reprise automatiquement. Connectez-vous pour continuer."

export type ResumeGuardEnv = {
  storage: () => Pick<Storage, "getItem" | "setItem"> | null // peut lever (stockage bloqué)
  readCookies: () => string // peut lever
  writeCookie: (line: string) => void // peut lever ou être ignoré
  now: () => number
  secure: boolean
}

export function browserGuardEnv(): ResumeGuardEnv {
  return {
    storage: () => window.sessionStorage,
    readCookies: () => document.cookie,
    writeCookie: (line) => {
      document.cookie = line
    },
    now: () => Date.now(),
    secure: window.location.protocol === "https:",
  }
}

// Nombre de retours notés dans le cookie (0 si absent, illisible ou hors bornes)
export function resumeCount(cookieString: string): number {
  for (const part of cookieString.split(";")) {
    const [k, v] = part.trim().split("=")
    if (k !== RESUME_COOKIE) continue
    if (!/^\d{1,3}$/.test(v ?? "")) return 0
    return Number(v)
  }
  return 0
}

export function resumeCookieLine(count: number, secure: boolean): string {
  return `${RESUME_COOKIE}=${count}; Path=/session; Max-Age=${RESUME_COOKIE_MAX_AGE_S}; SameSite=Strict${secure ? "; Secure" : ""}`
}

function safeCookies(env: ResumeGuardEnv): string {
  try {
    return env.readCookies()
  } catch {
    return ""
  }
}

// Vrai si un retour récent empêche un nouvel essai automatique (onglet ou navigateur)
export function resumeLimitReached(env: ResumeGuardEnv): boolean {
  try {
    const at = Number(env.storage()?.getItem(ATTEMPT_KEY))
    if (at > 0 && env.now() - at < ATTEMPT_WINDOW_MS) return true
  } catch {
    // stockage bloqué : le cookie seul compte
  }
  return resumeCount(safeCookies(env)) >= RESUME_LIMIT
}

// Note un retour vers la page protégée. Vrai si au moins une des deux marques est relue.
export function recordResume(env: ResumeGuardEnv): boolean {
  let stored = false
  try {
    const storage = env.storage()
    if (storage) {
      const at = String(env.now())
      storage.setItem(ATTEMPT_KEY, at)
      stored = storage.getItem(ATTEMPT_KEY) === at
    }
  } catch {
    // stockage bloqué
  }
  // sessionStorage relu : il suffit, et le cookie (commun aux onglets) reste réservé aux navigateurs sans
  // stockage ; sinon, plusieurs onglets restaurés ensemble atteindraient la borne et s'arrêteraient à tort
  if (stored) return true
  const next = Math.min(resumeCount(safeCookies(env)) + 1, 999)
  try {
    env.writeCookie(resumeCookieLine(next, env.secure))
  } catch {
    // cookies bloqués : la garde user_role de resumeSession envoie déjà vers /login
  }
  return stored || resumeCount(safeCookies(env)) >= next
}
