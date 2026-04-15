"use client"

import { useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { PricingConfig } from "@/lib/types"

// Placeholder : l'endpoint de config tarif sera ajouté côté backend
const DEFAULT_PRICING: PricingConfig = {
  pricePerKmTier1: 2.5,
  pricePerKmTier2: 2.0,
  pricePerKmTier3: 1.8,
  truckPricePerM3: {
    "12m3": 45,
    "16m3": 55,
    "20m3": 65,
  },
  handlerHourlyRate: 35,
}

export default function PricingPage() {
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_PRICING)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // TODO: connecter à PUT /admin/pricing quand l'endpoint existe
    await new Promise((r) => setTimeout(r, 800))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const setField = <K extends keyof PricingConfig>(
    key: K,
    value: PricingConfig[K],
  ) => setConfig((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Tarification</h1>
        <p className="mt-1 text-muted-foreground">
          Configurez les prix appliqués lors du calcul des devis.
        </p>
      </div>

      {/* Prix au km par tranche */}
      <Card>
        <CardHeader>
          <CardTitle>Prix au kilomètre</CardTitle>
          <CardDescription>
            Tarif dégressif par tranche de distance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["pricePerKmTier1", "0 — 20 km"],
              ["pricePerKmTier2", "20 — 50 km"],
              ["pricePerKmTier3", "50 km et +"],
            ] as const
          ).map(([field, label]) => (
            <div key={field} className="flex items-center gap-4">
              <Label className="w-36 shrink-0 text-sm">{label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={config[field]}
                  onChange={(e) =>
                    setField(field, parseFloat(e.target.value))
                  }
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">€ / km</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Prix par m³ selon type camion */}
      <Card>
        <CardHeader>
          <CardTitle>Prix de base par type de camion</CardTitle>
          <CardDescription>Forfait de base selon le volume</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(["12m3", "16m3", "20m3"] as const).map((truck) => (
            <div key={truck} className="flex items-center gap-4">
              <Label className="w-36 shrink-0 text-sm">Camion {truck}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={config.truckPricePerM3[truck]}
                  onChange={(e) =>
                    setField("truckPricePerM3", {
                      ...config.truckPricePerM3,
                      [truck]: parseFloat(e.target.value),
                    })
                  }
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">€ forfait</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Manutentionnaires */}
      <Card>
        <CardHeader>
          <CardTitle>Manutentionnaires</CardTitle>
          <CardDescription>
            Tarif horaire facturé par manutentionnaire
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label className="w-36 shrink-0 text-sm">Taux horaire</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.5"
                min="0"
                value={config.handlerHourlyRate}
                onChange={(e) =>
                  setField("handlerHourlyRate", parseFloat(e.target.value))
                }
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">€ / heure</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          {saved ? "Enregistré !" : "Enregistrer les tarifs"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Les modifications s'appliquent immédiatement aux nouveaux devis.
        </p>
      </div>
    </div>
  )
}
