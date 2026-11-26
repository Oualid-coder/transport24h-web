"use client"

import { useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Loader2 } from "lucide-react"
import type * as z from "@/lib/zod"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/PasswordInput"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { resetPassword } from "@/lib/api"
import {
  buildResetPasswordBody,
  isResetLinkInvalid,
  RESET_LINK_INVALID_MESSAGE,
  resetErrorMessage,
  resetPasswordSchema,
} from "@/lib/password"
import { onceReader, takeHashToken } from "@/lib/url-token"

type ResetForm = z.infer<typeof resetPasswordSchema>

// Lien du mail : /reset-password#token=<jeton>. Le jeton est lu dans le fragment (jamais envoyé
// au serveur), puis retiré de la barre d'adresse avant tout effet d'un autre composant (bandeau
// cookies, mesure publicitaire) : useLayoutEffect passe avant les useEffect du même rendu. Gardé en mémoire
// seulement, envoyé dans le corps de POST /auth/reset-password, jamais journalisé.
export default function ResetPasswordPage() {
  // undefined : pas encore lu (rendu serveur et hydratation) ; null : lien sans jeton
  const [token, setToken] = useState<string | null | undefined>(undefined)
  // Fragment lu une seule fois par instance (ref) : l'effet rejoué par Strict Mode retrouve le
  // même jeton au lieu de relire une URL déjà nettoyée.
  const readToken = useRef(onceReader(() => takeHashToken()))
  useLayoutEffect(() => {
    setToken(readToken.current())
  }, [])

  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [linkInvalid, setLinkInvalid] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = async (data: ResetForm) => {
    if (!token) return
    setServerError(null)
    try {
      await resetPassword(buildResetPasswordBody(token, data.password))
      setToken(null)
      setDone(true)
    } catch (err) {
      if (isResetLinkInvalid(err)) setLinkInvalid(true)
      setServerError(resetErrorMessage(err))
    }
  }

  let content: React.ReactNode
  if (token === undefined) {
    content = (
      <div className="flex justify-center py-6">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  } else if (done) {
    content = (
      <div role="status" className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-10 text-primary" />
        <p className="text-sm">
          Votre mot de passe a été modifié. Par sécurité, toutes vos sessions ont été fermées : connectez-vous
          avec votre nouveau mot de passe.
        </p>
        <Link href="/login" className="block text-sm text-primary underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </div>
    )
  } else if (token === null || linkInvalid) {
    content = (
      <div role="alert" className="space-y-4 text-center">
        <p className="text-sm text-destructive">
          {token === null ? "Lien de réinitialisation incomplet : ouvrez le lien reçu par email, sans le modifier." : RESET_LINK_INVALID_MESSAGE}
        </p>
        <Link href="/forgot-password" className="block text-sm text-primary underline-offset-4 hover:underline">
          Demander un nouveau lien
        </Link>
      </div>
    )
  } else {
    content = (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <PasswordInput
            id="password"
            placeholder="8 caractères minimum, au moins un chiffre"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
          <PasswordInput
            id="confirmPassword"
            placeholder="Répétez le mot de passe"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
        </div>

        {serverError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Enregistrer le nouveau mot de passe
        </Button>
      </form>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="pb-2">
            <h1 className="text-center text-lg font-semibold">Nouveau mot de passe</h1>
          </CardHeader>
          <CardContent>{content}</CardContent>
        </Card>
      </div>
    </div>
  )
}
