"use client"

import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CheckCircle2, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { sendContact, ApiError } from "@/lib/api"

const MAX_MESSAGE = 2000
const SUBJECT = "Demande professionnelle / forfait"

const schema = z.object({
  company: z.string().min(1, { message: "La raison sociale est requise" }).trim(),
  email: z
    .string()
    .min(1, { message: "L'adresse e-mail est requise" })
    .email({ message: "Adresse e-mail invalide" })
    .trim(),
  message: z
    .string()
    .min(1, { message: "Le message ne peut pas être vide" })
    .max(MAX_MESSAGE, { message: `${MAX_MESSAGE} caractères maximum` }),
})

type FormValues = z.infer<typeof schema>

export function EntreprisesForm() {
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { company: "", email: "", message: "" },
  })

  const messageValue = useWatch({ control, name: "message" })
  const messageLength = (messageValue ?? "").length

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const fullMessage = `Société : ${data.company}\n\n${data.message}`
    try {
      await sendContact({ email: data.email, subject: SUBJECT, message: fullMessage })
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setServerError("Trop de messages envoyés. Veuillez réessayer dans une heure.")
        } else {
          setServerError("Votre message n'a pas pu être envoyé. Merci de réessayer.")
        }
      } else {
        setServerError("Une erreur est survenue. Veuillez réessayer.")
      }
    }
  }

  if (success) {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-7 text-primary" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Demande envoyée</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Nous vous répondrons dès que possible.
        </p>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="company">Raison sociale</Label>
              <Input
                id="company"
                type="text"
                placeholder="Votre entreprise"
                autoComplete="organization"
                aria-invalid={!!errors.company}
                {...register("company")}
              />
              {errors.company && (
                <p className="text-xs text-destructive">{errors.company.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@entreprise.fr"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subject">Sujet</Label>
            <Input id="subject" value={SUBJECT} readOnly className="bg-muted text-muted-foreground" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Votre demande</Label>
            <textarea
              id="message"
              rows={5}
              placeholder="Décrivez vos besoins (volume, fréquence, zones géographiques…)"
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
                  messageLength > MAX_MESSAGE ? "text-destructive" : "text-muted-foreground"
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
            Envoyer la demande
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Les informations saisies servent uniquement à répondre à votre demande.{" "}
            <Link href="/politique-de-confidentialite" className="underline underline-offset-2">
              Politique de confidentialité
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
