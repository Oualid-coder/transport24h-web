"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Shield,
  Truck,
  Users,
} from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { registerPartner, ApiError } from "@/lib/api"
import type { TruckType } from "@/lib/types"
import { BackButton } from "@/components/BackButton"

const partnerSchema = z.object({
  firstName: z
    .string()
    .min(2, { error: "Prénom trop court" })
    .trim(),
  lastName: z
    .string()
    .min(2, { error: "Nom trop court" })
    .trim(),
  email: z.string().email({ error: "Adresse e-mail invalide" }).trim(),
  phone: z
    .string()
    .trim()
    .regex(/^(0|\+33)[1-9][0-9]{8}$/, {
      error: "Numéro invalide — ex : 0612345678 ou +33612345678",
    }),
  siret: z
    .string()
    .trim()
    .regex(/^[0-9]{14}$/, { error: "Le SIRET doit contenir exactement 14 chiffres" }),
  truckType: z.enum(["12m3", "16m3", "20m3"], {
    error: "Sélectionnez un type de camion",
  }),
})

type PartnerForm = z.infer<typeof partnerSchema>

export default function PartnersPage() {
  const [truckType, setTruckType] = useState<TruckType | "">("")
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PartnerForm>({
    resolver: zodResolver(partnerSchema),
  })

  const onSubmit = async (data: PartnerForm) => {
    setServerError(null)
    try {
      await registerPartner({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        siret: data.siret,
        truck_type: data.truckType,
      })
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message)
      } else {
        setServerError("Une erreur est survenue. Veuillez réessayer.")
      }
    }
  }

  if (success) {
    return (
      <div className="relative flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="absolute top-4 left-4">
          <BackButton href="/" />
        </div>
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-8 text-primary" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">Candidature reçue !</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Nous avons bien reçu votre demande. Notre équipe vous contactera dans
          les 24h pour valider votre profil.
        </p>
        <Button className="mt-8" render={<Link href="/" />}>
          Retour à l'accueil
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 pt-4">
        <BackButton href="/" />
      </div>
      {/* Hero */}
      <section className="border-b border-border/50 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
              <Truck className="size-3.5" />
              On recrute des chauffeurs partenaires
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Développez votre activité avec Transport24h
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Rejoignez notre réseau de chauffeurs indépendants et accédez à des
              missions régulières dans votre secteur.
            </p>
          </div>

          {/* Avantages */}
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: <Truck className="size-5 text-primary" />,
                title: "Missions flexibles",
                desc: "Choisissez vos créneaux et votre zone d'intervention.",
              },
              {
                icon: <Shield className="size-5 text-primary" />,
                title: "Paiement garanti",
                desc: "Rémunération versée sous 48h après chaque mission.",
              },
              {
                icon: <Users className="size-5 text-primary" />,
                title: "Support dédié",
                desc: "Une équipe disponible 7j/7 pour vous accompagner.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex gap-4 rounded-xl border border-border/50 bg-card p-5"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{f.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formulaire */}
      <section className="py-16">
        <div className="mx-auto max-w-lg px-4">
          <Card>
            <CardHeader>
              <CardTitle>Rejoindre le réseau</CardTitle>
              <CardDescription>
                Remplissez ce formulaire — notre équipe reviendra vers vous sous
                24h.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      id="firstName"
                      placeholder="Jean"
                      aria-invalid={!!errors.firstName}
                      {...register("firstName")}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-destructive">
                        {errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      id="lastName"
                      placeholder="Dupont"
                      aria-invalid={!!errors.lastName}
                      {...register("lastName")}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-destructive">
                        {errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Adresse e-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jean@exemple.fr"
                    aria-invalid={!!errors.email}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone">Numéro de téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="06 12 34 56 78"
                    aria-invalid={!!errors.phone}
                    {...register("phone")}
                  />
                  {errors.phone && (
                    <p className="text-xs text-destructive">
                      {errors.phone.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="siret">Numéro SIRET</Label>
                  <Input
                    id="siret"
                    placeholder="12345678901234"
                    maxLength={14}
                    aria-invalid={!!errors.siret}
                    {...register("siret")}
                  />
                  {errors.siret && (
                    <p className="text-xs text-destructive">
                      {errors.siret.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Type de camion</Label>
                  <Select
                    value={truckType}
                    onValueChange={(v) => {
                      const t = v as TruckType
                      setTruckType(t)
                      setValue("truckType", t, { shouldValidate: true })
                    }}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={!!errors.truckType}
                    >
                      <SelectValue placeholder="Sélectionnez un volume" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12m3">12 m³ — Studio / 1 pièce</SelectItem>
                      <SelectItem value="16m3">16 m³ — 2–3 pièces</SelectItem>
                      <SelectItem value="20m3">20 m³ — 4 pièces et +</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.truckType && (
                    <p className="text-xs text-destructive">
                      {errors.truckType.message}
                    </p>
                  )}
                </div>

                {serverError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {serverError}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 size-4" />
                  )}
                  Envoyer ma candidature
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
