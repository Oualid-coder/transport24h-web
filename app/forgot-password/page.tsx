"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Loader2 } from "lucide-react"
import type * as z from "@/lib/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { BackButton } from "@/components/BackButton"
import { requestPasswordReset } from "@/lib/api"
import { FORGOT_SENT_MESSAGE, forgotErrorMessage, forgotPasswordSchema } from "@/lib/password"

type ForgotForm = z.infer<typeof forgotPasswordSchema>

// Demande d'un lien de réinitialisation. L'API répond pareil que le compte existe ou non :
// le message affiché ne dit jamais si l'adresse est connue.
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = async (data: ForgotForm) => {
    setServerError(null)
    try {
      await requestPasswordReset(data.email)
      setSent(true)
    } catch (err) {
      setServerError(forgotErrorMessage(err))
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute top-4 left-4">
        <BackButton href="/login" />
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="pb-2">
            <h1 className="text-center text-lg font-semibold">Mot de passe oublié</h1>
            <p className="text-center text-sm text-muted-foreground">
              Indiquez l&apos;adresse e-mail de votre compte : nous vous enverrons un lien pour choisir un
              nouveau mot de passe.
            </p>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div role="status" className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-primary">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <p>{FORGOT_SENT_MESSAGE}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rien reçu après quelques minutes ? Vérifiez vos courriers indésirables, puis réessayez.
                </p>
                <Link href="/login" className="block text-center text-sm text-primary underline-offset-4 hover:underline">
                  Retour à la connexion
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>

                {serverError && (
                  <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {serverError}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Recevoir un lien
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
