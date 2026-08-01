"use client"

import { useRef, useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileCheck,
  Loader2,
  Shield,
  Truck,
  Upload,
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
import { registerPartner, uploadPartnerDocument, ApiError } from "@/lib/api"
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
  truckType: z.enum(["6m3", "12m3", "20m3"], {
    error: "Sélectionnez un type de camion",
  }),
})

type PartnerForm = z.infer<typeof partnerSchema>

type DocType = "kbis" | "licence_mere" | "rcp" | "urssaf"

interface DocState {
  status: "idle" | "uploading" | "done" | "error"
  filename: string | null
  error: string | null
}

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"]
const MAX_SIZE = 10 * 1024 * 1024

const INITIAL_DOC_STATES: Record<DocType, DocState> = {
  kbis: { status: "idle", filename: null, error: null },
  licence_mere: { status: "idle", filename: null, error: null },
  rcp: { status: "idle", filename: null, error: null },
  urssaf: { status: "idle", filename: null, error: null },
}

const DOC_CONFIGS: Array<{ type: DocType; label: string; icon: React.ReactNode }> = [
  { type: "kbis", label: "Extrait KBIS", icon: <Building2 className="size-4 text-primary" /> },
  { type: "licence_mere", label: "Licence mère", icon: <Truck className="size-4 text-primary" /> },
  { type: "rcp", label: "Attestation RCP", icon: <Shield className="size-4 text-primary" /> },
  { type: "urssaf", label: "Attestation de vigilance URSSAF", icon: <FileCheck className="size-4 text-primary" /> },
]

interface DocUploadRowProps {
  config: (typeof DOC_CONFIGS)[number]
  state: DocState
  onUpload: (docType: DocType, file: File) => Promise<void>
}

function DocUploadRow({ config, state, onUpload }: DocUploadRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await onUpload(config.type, file)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-card p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
          {config.icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{config.label}</p>
          {state.status === "done" && state.filename && (
            <p className="text-xs text-muted-foreground truncate">{state.filename}</p>
          )}
          {state.status === "error" && state.error && (
            <p className="text-xs text-destructive">{state.error}</p>
          )}
        </div>
      </div>

      <div className="shrink-0">
        {state.status === "done" ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="size-4" />
            Envoyé
          </div>
        ) : state.status === "uploading" ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={handleChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-1.5 size-3.5" />
              Choisir
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default function PartnersPage() {
  const [truckType, setTruckType] = useState<TruckType | "">("")
  const [serverError, setServerError] = useState<string | null>(null)
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [docStates, setDocStates] = useState<Record<DocType, DocState>>(INITIAL_DOC_STATES)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id")
    if (id) setApplicationId(id)
  }, [])

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
      const application = await registerPartner({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        siret: data.siret,
        truck_type: data.truckType,
      })
      setApplicationId(application.id)
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message)
      } else {
        setServerError("Une erreur est survenue. Veuillez réessayer.")
      }
    }
  }

  const handleDocUpload = async (docType: DocType, file: File) => {
    if (!ALLOWED_MIME.includes(file.type)) {
      setDocStates((prev) => ({
        ...prev,
        [docType]: {
          status: "error",
          filename: null,
          error: "Format non accepté — PDF, JPG ou PNG uniquement.",
        },
      }))
      return
    }
    if (file.size > MAX_SIZE) {
      setDocStates((prev) => ({
        ...prev,
        [docType]: {
          status: "error",
          filename: null,
          error: "Fichier trop volumineux — 10 Mo maximum.",
        },
      }))
      return
    }

    setDocStates((prev) => ({
      ...prev,
      [docType]: { status: "uploading", filename: null, error: null },
    }))

    try {
      await uploadPartnerDocument(applicationId!, docType, file)
      setDocStates((prev) => ({
        ...prev,
        [docType]: { status: "done", filename: file.name, error: null },
      }))
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Erreur lors de l'envoi."
      setDocStates((prev) => ({
        ...prev,
        [docType]: { status: "error", filename: null, error: message },
      }))
    }
  }

  const uploadedCount = Object.values(docStates).filter((s) => s.status === "done").length
  const allUploaded = uploadedCount === 4

  if (success) {
    return (
      <div className="relative flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="absolute top-4 left-4">
          <BackButton href="/" />
        </div>
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-8 text-primary" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">Dossier transmis !</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Votre dossier a été transmis avec succès. Notre équipe vous contactera
          dans les 24h pour valider votre profil.
        </p>
        <Button className="mt-8" render={<Link href="/" />}>
          Retour à l&apos;accueil
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
                className="flex gap-4 rounded-lg border border-border/50 bg-card p-5"
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

      {/* Formulaire / Documents */}
      <section className="py-16">
        <div className="mx-auto max-w-lg px-4">
          {applicationId === null ? (
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
                        <SelectItem value="6m3">6 m³</SelectItem>
                        <SelectItem value="12m3">12 m³</SelectItem>
                        <SelectItem value="20m3">20 m³</SelectItem>
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
                    Continuer
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Documents requis</CardTitle>
                <CardDescription>
                  Envoyez vos justificatifs pour compléter votre dossier (PDF, JPG ou PNG — 10 Mo max par fichier).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {uploadedCount}/4 documents envoyés
                </p>

                <div className="space-y-3">
                  {DOC_CONFIGS.map((config) => (
                    <DocUploadRow
                      key={config.type}
                      config={config}
                      state={docStates[config.type]}
                      onUpload={handleDocUpload}
                    />
                  ))}
                </div>

                {allUploaded && (
                  <Button className="w-full" onClick={() => setSuccess(true)}>
                    <CheckCircle2 className="mr-2 size-4" />
                    Finaliser ma candidature
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  )
}
