"use client"

import dynamic from "next/dynamic"
import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  Truck,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { geocodeAddress, getQuoteEstimate } from "@/lib/api"
import { TRUCK_VOLUME } from "@/lib/types"
import type { GeoPoint, TruckType } from "@/lib/types"

// Leaflet n'existe pas côté serveur
const DevisMap = dynamic(
  () => import("@/components/map/DevisMap").then((m) => m.DevisMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-muted" /> },
)

const TRUCKS: { type: TruckType; label: string; desc: string }[] = [
  { type: "12m3", label: "12 m³", desc: "Studio / 1 pièce" },
  { type: "16m3", label: "16 m³", desc: "2–3 pièces" },
  { type: "20m3", label: "20 m³", desc: "4 pièces et +" },
]

export default function HomePage() {
  const [truckType, setTruckType] = useState<TruckType>("16m3")
  const [handlers, setHandlers] = useState(1)
  const [originInput, setOriginInput] = useState("")
  const [destInput, setDestInput] = useState("")
  const [origin, setOrigin] = useState<GeoPoint | null>(null)
  const [destination, setDestination] = useState<GeoPoint | null>(null)
  const [phone, setPhone] = useState("")
  const [comment, setComment] = useState("")
  const [geocoding, setGeocoding] = useState<"origin" | "dest" | null>(null)

  // Geocode avec debounce 500ms sur chaque champ adresse
  useEffect(() => {
    if (originInput.trim().length < 5) {
      setOrigin(null)
      return
    }
    const timer = setTimeout(async () => {
      setGeocoding("origin")
      const pt = await geocodeAddress(originInput)
      setOrigin(pt)
      setGeocoding(null)
    }, 500)
    return () => clearTimeout(timer)
  }, [originInput])

  useEffect(() => {
    if (destInput.trim().length < 5) {
      setDestination(null)
      return
    }
    const timer = setTimeout(async () => {
      setGeocoding("dest")
      const pt = await geocodeAddress(destInput)
      setDestination(pt)
      setGeocoding(null)
    }, 500)
    return () => clearTimeout(timer)
  }, [destInput])

  // Devis en temps réel dès que les deux points sont géocodés
  const quoteReady = origin !== null && destination !== null

  const { data: quote, isFetching: quoteFetching } = useQuery({
    queryKey: ["quote", origin, destination, truckType, handlers],
    queryFn: () =>
      getQuoteEstimate({
        pickup_lat: origin!.lat,
        pickup_lng: origin!.lng,
        delivery_lat: destination!.lat,
        delivery_lng: destination!.lng,
        volume_m3: TRUCK_VOLUME[truckType],
        helpers_count: handlers,
        truck_type: truckType,
      }),
    enabled: quoteReady,
    staleTime: 60_000,
  })

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.58_0.22_262/0.25),transparent)]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
              <CheckCircle2 className="size-3.5" />
              Disponible 7j/7 — Réponse en moins de 2h
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Votre transport{" "}
              <span className="text-primary">professionnel</span>
              <br />à portée de clic
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Déménagement, livraison d&apos;encombrants, transport de matériel.
              Obtenez un prix instantané et réservez en ligne.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" render={<a href="#devis" />}>
                Obtenir mon devis gratuit
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-4 text-center">
            {[
              { value: "4 500+", label: "Transports réalisés" },
              { value: "98%", label: "Clients satisfaits" },
              { value: "< 2h", label: "Délai de réponse" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border/50 bg-card p-4">
                <div className="text-2xl font-bold text-primary">{s.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Formulaire devis ──────────────────────────────────────────────── */}
      <section id="devis" className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold">Calculez votre devis</h2>
            <p className="mt-2 text-muted-foreground">
              Prix calculé en temps réel selon votre trajet et vos besoins
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            {/* Form — 3 cols */}
            <div className="lg:col-span-3 space-y-6">
              {/* Choix camion */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Truck className="size-4 text-primary" />
                    Type de camion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {TRUCKS.map((t) => (
                      <button
                        key={t.type}
                        onClick={() => setTruckType(t.type)}
                        className={`rounded-lg border p-3 text-left transition-all ${
                          truckType === t.type
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border/50 bg-card hover:border-border hover:bg-accent"
                        }`}
                      >
                        <div className="font-semibold text-sm">{t.label}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {t.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Adresses */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MapPin className="size-4 text-primary" />
                    Adresses
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="origin">Adresse de départ</Label>
                    <div className="relative">
                      <Input
                        id="origin"
                        placeholder="Ex: 12 rue de la Paix, Paris"
                        value={originInput}
                        onChange={(e) => setOriginInput(e.target.value)}
                        className="pr-8"
                      />
                      {geocoding === "origin" && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {origin && (
                      <p className="text-xs text-primary truncate">
                        ✓ {origin.address}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="dest">Adresse d&apos;arrivée</Label>
                    <div className="relative">
                      <Input
                        id="dest"
                        placeholder="Ex: 5 avenue Victor Hugo, Lyon"
                        value={destInput}
                        onChange={(e) => setDestInput(e.target.value)}
                        className="pr-8"
                      />
                      {geocoding === "dest" && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {destination && (
                      <p className="text-xs text-primary truncate">
                        ✓ {destination.address}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Manutentionnaires */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Users className="size-4 text-primary" />
                    Manutentionnaires —{" "}
                    {handlers === 0
                      ? "Aucun"
                      : handlers === 1
                        ? "1 manutentionnaire"
                        : "2 manutentionnaires"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6">
                  <Slider
                    min={0}
                    max={2}
                    step={1}
                    value={[handlers]}
                    onValueChange={(v) =>
                      setHandlers(Array.isArray(v) ? (v[0] ?? 0) : v)
                    }
                    className="my-2"
                  />
                  <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span>1</span>
                    <span>2</span>
                  </div>
                </CardContent>
              </Card>

              {/* Contact */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Phone className="size-4 text-primary" />
                    Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Numéro de téléphone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="06 12 34 56 78"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="comment">
                      Commentaire{" "}
                      <span className="text-xs text-muted-foreground">
                        (optionnel)
                      </span>
                    </Label>
                    <Textarea
                      id="comment"
                      placeholder="Étages, monte-meuble, objets fragiles..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Carte + Prix — 2 cols */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Carte */}
              <div className="h-72 overflow-hidden rounded-xl border border-border/50 lg:h-80">
                <DevisMap
                  origin={origin}
                  destination={destination}
                  className="h-full w-full"
                />
              </div>

              {/* Prix */}
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="text-sm">Estimation de prix</CardTitle>
                </CardHeader>
                <CardContent>
                  {!quoteReady ? (
                    <p className="text-sm text-muted-foreground">
                      Renseignez les adresses de départ et d&apos;arrivée pour
                      voir le prix.
                    </p>
                  ) : quoteFetching ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Calcul en cours…
                    </div>
                  ) : quote ? (
                    <div className="space-y-4">
                      <div className="flex items-end justify-between">
                        <span className="text-sm text-muted-foreground">
                          Prix HT
                        </span>
                        <span className="text-3xl font-bold text-primary">
                          {quote.price_ht.toFixed(2)} €
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Distance</span>
                          <span>{quote.distance_km.toFixed(0)} km</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Volume</span>
                          <span>{quote.volume_m3} m³</span>
                        </div>
                        {quote.helpers_count > 0 && (
                          <div className="flex justify-between">
                            <span>Manutentionnaires</span>
                            <span>{quote.helpers_count}</span>
                          </div>
                        )}
                      </div>
                      {phone ? (
                        <Button
                          className="w-full"
                          render={
                            <a
                              href={`/booking?truck=${truckType}&handlers=${handlers}&pickupLat=${origin?.lat}&pickupLng=${origin?.lng}&pickup=${encodeURIComponent(origin?.address ?? "")}&deliveryLat=${destination?.lat}&deliveryLng=${destination?.lng}&delivery=${encodeURIComponent(destination?.address ?? "")}&phone=${encodeURIComponent(phone)}&comment=${encodeURIComponent(comment)}`}
                            />
                          }
                        >
                          Réserver maintenant
                          <ArrowRight className="ml-2 size-4" />
                        </Button>
                      ) : (
                        <Button className="w-full" disabled>
                          Réserver maintenant
                          <ArrowRight className="ml-2 size-4" />
                        </Button>
                      )}
                      {!phone && (
                        <p className="text-center text-xs text-muted-foreground">
                          Renseignez votre numéro pour continuer
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Impossible de calculer le prix pour ce trajet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ── Avantages ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="mb-12 text-center text-3xl font-bold">
            Pourquoi choisir Transport24h ?
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <CheckCircle2 className="size-5 text-primary" />,
                title: "Prix transparents",
                desc: "Le prix affiché est le prix final. Pas de mauvaise surprise à l&apos;arrivée.",
              },
              {
                icon: <Truck className="size-5 text-primary" />,
                title: "Chauffeurs vérifiés",
                desc: "Tous nos partenaires sont professionnels, assurés et évalués.",
              },
              {
                icon: <Users className="size-5 text-primary" />,
                title: "Manutentionnaires disponibles",
                desc: "Ajoutez jusqu&apos;à 2 manutentionnaires pour le chargement et déchargement.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border/50 bg-card p-6"
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  {f.icon}
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
