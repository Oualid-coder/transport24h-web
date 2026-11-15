"use client"

// Client : lit le choix en localStorage, gère la bannière et le panneau de réglages.

import Link from "next/link"
import { useEffect, useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import {
  OPEN_SETTINGS_EVENT,
  getConsentStatus,
  loadGoogleAds,
  setAdsConsent,
  subscribeConsent,
  type ConsentStatus,
} from "@/lib/consent"

type Status = ConsentStatus | "pending"

const getServerStatus = (): Status => "pending"

export function CookieConsent() {
  const status = useSyncExternalStore<Status>(
    subscribeConsent,
    getConsentStatus,
    getServerStatus,
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [adsChecked, setAdsChecked] = useState(false)

  useEffect(() => {
    if (status === "granted") loadGoogleAds()
  }, [status])

  useEffect(() => {
    const open = () => {
      setAdsChecked(getConsentStatus() === "granted")
      setSettingsOpen(true)
    }
    window.addEventListener(OPEN_SETTINGS_EVENT, open)
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open)
  }, [])

  const choose = (ads: boolean) => {
    setSettingsOpen(false)
    setAdsConsent(ads)
  }

  if (status === "pending") return null
  if (!settingsOpen && status !== "unset") return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/95 px-4 py-4 shadow-lg backdrop-blur-md sm:px-6"
    >
      <div className="mx-auto max-w-3xl space-y-3 text-sm">
        <p id="cookie-consent-title" className="font-semibold">
          {settingsOpen ? "Gérer mes cookies" : "Vos choix en matière de cookies"}
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Avec votre accord, nous utilisons Google Ads pour mesurer les réservations
          issues de nos annonces. Sans accord, aucun script Google n&apos;est chargé.
          Votre choix est conservé 6 mois et modifiable à tout moment via « Gérer mes
          cookies » en bas de page.{" "}
          <Link
            href="/politique-de-confidentialite#cookies"
            className="text-primary underline underline-offset-4 hover:no-underline"
          >
            En savoir plus
          </Link>
        </p>

        {settingsOpen && (
          <label className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={adsChecked}
              onChange={(e) => setAdsChecked(e.target.checked)}
            />
            <span>
              <span className="font-medium">Mesure publicitaire (Google Ads)</span>
              <span className="block text-xs text-muted-foreground">
                Mesure des conversions issues de nos annonces Google Ads.
              </span>
            </span>
          </label>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button size="lg" className="sm:min-w-36" onClick={() => choose(false)}>
            Tout refuser
          </Button>
          <Button size="lg" className="sm:min-w-36" onClick={() => choose(true)}>
            Tout accepter
          </Button>
          {settingsOpen ? (
            <div className="flex gap-2 sm:ml-auto">
              <Button
                size="lg"
                variant="outline"
                onClick={() => choose(adsChecked)}
              >
                Enregistrer mes choix
              </Button>
              {status !== "unset" && (
                <Button size="lg" variant="ghost" onClick={() => setSettingsOpen(false)}>
                  Fermer
                </Button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground sm:ml-auto"
              onClick={() => {
                setAdsChecked(false)
                setSettingsOpen(true)
              }}
            >
              Personnaliser
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}
    >
      Gérer mes cookies
    </button>
  )
}
