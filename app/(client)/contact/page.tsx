"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import * as z from "zod"
import { CheckCircle2, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { BackButton } from "@/components/BackButton"
import { sendContact, ApiError } from "@/lib/api"

const SUBJECTS = [
  "Question générale",
  "Demande professionnelle / forfait",
  "Réclamation",
  "Autre",
] as const

const MAX_MESSAGE = 2000

const contactSchema = z.object({
  email: z
    .string()
    .min(1, { message: "L'adresse e-mail est requise" })
    .email({ message: "Adresse e-mail invalide" })
    .trim(),
  subject: z.string().min(1, { message: "Veuillez sélectionner un sujet" }),
  message: z
    .string()
    .min(1, { message: "Le message ne peut pas être vide" })
    .max(MAX_MESSAGE, { message: `${MAX_MESSAGE} caractères maximum` }),
})

type ContactForm = z.infer<typeof contactSchema>

export default function ContactPage() {
  const router = useRouter()
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { email: "", subject: "", message: "" },
  })

  const messageLength = (watch("message") ?? "").length

  const onSubmit = async (data: ContactForm) => {
    setServerError(null)
    try {
      await sendContact({ email: data.email, subject: data.subject, message: data.message })
      setSuccess(true)
    } catch (err) {
      setServerError(
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue. Veuillez réessayer.",
      )
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-8 text-primary" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Message envoyé</h1>
        <p className="mt-2 text-muted-foreground">
          Votre message a été envoyé, nous vous répondrons sous 2h.
        </p>
        <Button className="mt-8" onClick={() => router.push("/")}>
          Retour à l&apos;accueil
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-8">
        <BackButton href="/" />
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Nous contacter</h1>
        <p className="mt-2 text-muted-foreground">
          Une question, une demande professionnelle ou une réclamation ? Nous vous
          répondons sous 2h.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* E-mail */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.fr"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Sujet */}
            <div className="space-y-1.5">
              <Label htmlFor="subject">Sujet</Label>
              <select
                id="subject"
                aria-invalid={!!errors.subject}
                className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  errors.subject ? "border-destructive" : "border-input"
                }`}
                {...register("subject")}
              >
                <option value="">Sélectionnez un sujet</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.subject && (
                <p className="text-xs text-destructive">{errors.subject.message}</p>
              )}
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                rows={6}
                placeholder="Décrivez votre demande..."
                aria-invalid={!!errors.message}
                className={`flex w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  errors.message ? "border-destructive" : "border-input"
                }`}
                {...register("message")}
              />
              <div className="flex items-start justify-between gap-2">
                {errors.message ? (
                  <p className="text-xs text-destructive">{errors.message.message}</p>
                ) : (
                  <span />
                )}
                <p
                  className={`shrink-0 text-xs tabular-nums ${
                    messageLength > MAX_MESSAGE
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {messageLength}/{MAX_MESSAGE}
                </p>
              </div>
            </div>

            {serverError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Envoyer le message
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
