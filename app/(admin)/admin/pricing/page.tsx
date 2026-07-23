"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Info, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BackButton } from "@/components/BackButton"
import { getPricingConfig, getTruckSurcharges, updatePricing, updateTruckSurcharge, getHelpersSurcharges, updateHelpersSurcharge, ApiError } from "@/lib/api"
import type { PricingConfig, TruckSurcharge, HelpersSurcharge } from "@/lib/types"

// ── Ligne du tableau ──────────────────────────────────────────────────────────

function formatDistance(row: PricingConfig): string {
  if (row.distance_max_km === null) {
    return `${row.distance_min_km} km et +`
  }
  return `${row.distance_min_km} → ${row.distance_max_km} km`
}

function PricingRow({ row }: { row: PricingConfig }) {
  const queryClient = useQueryClient()
  const initialValue = row.is_fixed_price
    ? (row.price_fixed ?? 0)
    : (row.price_per_km ?? 0)
  const [draft, setDraft] = useState(String(initialValue))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (value: number) =>
      updatePricing(
        row.id,
        row.is_fixed_price ? { price_fixed: value } : { price_per_km: value },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pricing"] })
      setSaved(true)
      setError(null)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de la sauvegarde.",
      )
    },
  })

  const handleSave = () => {
    const value = parseFloat(draft)
    if (isNaN(value) || value < 0) return
    mutation.mutate(value)
  }

  const isFirstInterval = row.distance_min_km === 0
  const priceUnit = row.is_fixed_price ? "€" : "€ / km"

  return (
    <>
      <tr className="border-b border-border/50 last:border-0">
        <td className="py-3 pr-4 text-sm font-medium">{row.label}</td>
        <td className="py-3 pr-4 font-mono text-sm text-muted-foreground whitespace-nowrap">
          {formatDistance(row)}
        </td>
        <td className="py-3 pr-4">
          <Badge
            variant={row.is_fixed_price ? "secondary" : "outline"}
            className="text-xs"
          >
            {row.is_fixed_price ? "Prix fixe" : "Prix / km"}
          </Badge>
        </td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setSaved(false)
              }}
              className="h-8 w-28 text-sm"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {priceUnit}
            </span>
          </div>
        </td>
        <td className="py-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-3.5" />
            )}
            {saved ? "Enregistré !" : "Sauvegarder"}
          </Button>
        </td>
      </tr>

      {isFirstInterval && (
        <tr>
          <td colSpan={5} className="pb-3 pt-1">
            <div className="flex items-start gap-2 rounded-lg border border-green/20 bg-green-light px-3 py-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Prix fixe de mise à disposition
                </span>{" "}
                — protège contre les abus pour les très courtes distances.
              </p>
            </div>
          </td>
        </tr>
      )}

      {error && (
        <tr>
          <td colSpan={5} className="pb-2">
            <p className="text-xs text-destructive">{error}</p>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Ligne surcharge camion ────────────────────────────────────────────────────

function TruckSurchargeRow({ row }: { row: TruckSurcharge }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(String(row.surcharge_ht))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (value: number) => updateTruckSurcharge(row.truck_type, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-truck-surcharges"] })
      setSaved(true)
      setError(null)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de la sauvegarde.",
      )
    },
  })

  const handleSave = () => {
    const value = parseFloat(draft)
    if (isNaN(value) || value < 0) return
    mutation.mutate(value)
  }

  return (
    <>
      <tr className="border-b border-border/50 last:border-0">
        <td className="py-3 pr-4 text-sm font-medium">
          {row.truck_type.replace("m3", " m³")}
        </td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setSaved(false)
              }}
              className="h-8 w-28 text-sm"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              € HT
            </span>
          </div>
        </td>
        <td className="py-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-3.5" />
            )}
            {saved ? "Enregistré !" : "Sauvegarder"}
          </Button>
        </td>
      </tr>

      {error && (
        <tr>
          <td colSpan={3} className="pb-2">
            <p className="text-xs text-destructive">{error}</p>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Section surcharges camion ─────────────────────────────────────────────────

function TruckSurchargesCard() {
  const { data: surcharges, isLoading, error } = useQuery<TruckSurcharge[]>({
    queryKey: ["admin-truck-surcharges"],
    queryFn: getTruckSurcharges,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Surcharge par type de camion</CardTitle>
        <CardDescription>
          Montant fixe ajouté au prix de base selon le véhicule sélectionné
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">
            {error instanceof ApiError
              ? error.message
              : "Impossible de charger les surcharges."}
          </p>
        )}

        {surcharges && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Camion</th>
                  <th className="pb-2 pr-4 text-left font-medium">Surcharge HT</th>
                  <th className="pb-2 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {surcharges.map((row) => (
                  <TruckSurchargeRow key={row.truck_type} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Ligne surcharge manutentionnaire ─────────────────────────────────────────

function HelpersSurchargeRow({ row }: { row: HelpersSurcharge }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(String(row.surcharge_pct))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (value: number) => updateHelpersSurcharge(row.helpers_count, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-helpers-surcharges"] })
      setSaved(true)
      setError(null)
      setTimeout(() => setSaved(false), 2000)
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de la sauvegarde.",
      )
    },
  })

  const handleSave = () => {
    const value = parseFloat(draft)
    if (isNaN(value) || value < 0 || value > 100) return
    mutation.mutate(value)
  }

  const label =
    row.helpers_count === 1 ? "1 manutentionnaire" : `${row.helpers_count} manutentionnaires`

  return (
    <>
      <tr className="border-b border-border/50 last:border-0">
        <td className="py-3 pr-4 text-sm font-medium">{label}</td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="1"
              min="0"
              max="100"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setSaved(false)
              }}
              className="h-8 w-24 text-sm"
            />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              %
            </span>
          </div>
        </td>
        <td className="py-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-3.5" />
            )}
            {saved ? "Enregistré !" : "Sauvegarder"}
          </Button>
        </td>
      </tr>

      {error && (
        <tr>
          <td colSpan={3} className="pb-2">
            <p className="text-xs text-destructive">{error}</p>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Section surcharges manutentionnaire ──────────────────────────────────────

function HelpersSurchargesCard() {
  const { data: surcharges, isLoading, error } = useQuery<HelpersSurcharge[]>({
    queryKey: ["admin-helpers-surcharges"],
    queryFn: getHelpersSurcharges,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Surcharge par manutentionnaire</CardTitle>
        <CardDescription>
          Pourcentage ajouté au prix de base selon le nombre de manutentionnaires
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">
            {error instanceof ApiError
              ? error.message
              : "Impossible de charger les surcharges."}
          </p>
        )}

        {surcharges && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Manutentionnaires</th>
                  <th className="pb-2 pr-4 text-left font-medium">Surcharge (%)</th>
                  <th className="pb-2 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {surcharges.map((row) => (
                  <HelpersSurchargeRow key={row.helpers_count} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { data: intervals, isLoading, error } = useQuery<PricingConfig[]>({
    queryKey: ["admin-pricing"],
    queryFn: getPricingConfig,
  })

  return (
    <div className="max-w-3xl space-y-8">
      <BackButton href="/admin/dashboard" />

      <div>
        <h1 className="text-3xl font-bold">Tarification</h1>
        <p className="mt-1 text-muted-foreground">
          Configurez les prix appliqués lors du calcul des devis.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error instanceof ApiError
            ? error.message
            : "Impossible de charger la configuration."}
        </p>
      )}

      <TruckSurchargesCard />

      <HelpersSurchargesCard />

      {intervals && (
        <Card>
          <CardHeader>
            <CardTitle>Intervalles de distance</CardTitle>
            <CardDescription>
              {intervals.length} tranches — prix fixe ou au kilomètre selon la
              distance
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Label</th>
                  <th className="pb-2 pr-4 text-left font-medium">Distance</th>
                  <th className="pb-2 pr-4 text-left font-medium">Type</th>
                  <th className="pb-2 pr-4 text-left font-medium">Prix</th>
                  <th className="pb-2 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {intervals.map((row) => (
                  <PricingRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
