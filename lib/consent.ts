// Consentement cookies (mesure publicitaire Google Ads) + chargement différé de gtag.js.
// Aucun script Google n'est injecté tant que le visiteur n'a pas accepté.

export const GOOGLE_ADS_ID = "AW-18483112134"

const STORAGE_KEY = "t24h_cookie_consent"
const CHANGE_EVENT = "t24h:consent-change"
export const OPEN_SETTINGS_EVENT = "t24h:open-cookie-settings"
// Version du texte de consentement : l'incrémenter si les finalités changent
const CONSENT_VERSION = 1
// 180 jours : toujours inférieur ou égal à 6 mois calendaires
export const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000

export type ConsentStatus = "granted" | "denied" | "unset"

interface StoredConsent {
  v: number
  ads: boolean
  ts: number
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

// Fonction pure (testée) : interprète la valeur stockée, expire au-delà de 6 mois
export function parseConsent(raw: string | null, now: number): ConsentStatus {
  if (!raw) return "unset"
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return "unset"
  }
  if (typeof data !== "object" || data === null) return "unset"
  const { v, ads, ts } = data as Partial<StoredConsent> // forme vérifiée champ par champ ci-dessous
  if (v !== CONSENT_VERSION || typeof ads !== "boolean" || typeof ts !== "number") {
    return "unset"
  }
  if (ts > now || now - ts > CONSENT_MAX_AGE_MS) return "unset"
  return ads ? "granted" : "denied"
}

export function serializeConsent(ads: boolean, now: number): string {
  const value: StoredConsent = { v: CONSENT_VERSION, ads, ts: now }
  return JSON.stringify(value)
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function getConsentStatus(): ConsentStatus {
  if (typeof window === "undefined") return "unset"
  return parseConsent(readRaw(), Date.now())
}

export function hasAdsConsent(): boolean {
  return getConsentStatus() === "granted"
}

export function subscribeConsent(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

let gtagLoaded = false

// Injecte gtag.js (idempotent). Ne fait rien sans consentement.
export function loadGoogleAds(): void {
  if (gtagLoaded || !hasAdsConsent()) return
  gtagLoaded = true

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // gtag.js exige l'objet `arguments` (pas un tableau)
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments)
  }
  // Consent Mode v2 : tout refusé par défaut, puis accord limité à la mesure publicitaire
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  })
  window.gtag("consent", "update", {
    ad_storage: "granted",
    ad_user_data: "granted",
  })
  window.gtag("js", new Date())
  window.gtag("config", GOOGLE_ADS_ID)

  const script = document.createElement("script")
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`
  document.head.appendChild(script)
}

// Envoie un événement Google Ads uniquement si le consentement est donné
export function sendAdsEvent(name: string, params: Record<string, unknown>): void {
  if (!hasAdsConsent()) return
  loadGoogleAds()
  window.gtag?.("event", name, params)
}

// Supprime les cookies first-party posés par Google Ads (_gcl_*)
function deleteGoogleCookies(): void {
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0].trim())
    .filter((n) => n.startsWith("_gcl"))
  const parts = window.location.hostname.split(".")
  const domains: Array<string | null> = [null]
  for (let i = 0; i < parts.length - 1; i++) domains.push(parts.slice(i).join("."))
  for (const name of names) {
    for (const domain of domains) {
      const domainAttr = domain ? `; domain=${domain}` : ""
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainAttr}`
    }
  }
}

export function setAdsConsent(ads: boolean): void {
  const wasLoaded = gtagLoaded
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeConsent(ads, Date.now()))
  } catch {
    // stockage indisponible : le choix vaut pour la page en cours uniquement
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))

  if (ads) {
    loadGoogleAds()
    return
  }
  // Retrait : on coupe tout, on efface les cookies Google et on recharge
  // pour décharger gtag.js (sinon il continuerait d'émettre des pings sans cookie).
  window.gtag?.("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  })
  deleteGoogleCookies()
  if (wasLoaded) window.location.reload()
}
