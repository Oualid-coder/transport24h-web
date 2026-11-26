"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Loader2 } from "lucide-react"
import type * as z from "@/lib/zod"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/PasswordInput"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { changePassword } from "@/lib/api"
import {
  buildChangePasswordBody,
  changeErrorMessage,
  changePasswordSchema,
  RELOGIN_AFTER_CHANGE_URL,
} from "@/lib/password"

type ChangeForm = z.infer<typeof changePasswordSchema>

// Changement du mot de passe dans l'espace connecté (tous les rôles). Succès : l'API ferme toutes
// les autres sessions et en ouvre une nouvelle pour cet appareil (cookies reposés par
// /api/auth/change-password) ; un email de confirmation est envoyé.
export function ChangePasswordForm() {
  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeForm>({ resolver: zodResolver(changePasswordSchema) })

  const onSubmit = async (data: ChangeForm) => {
    setServerError(null)
    setDone(false)
    try {
      const { relogin } = await changePassword(buildChangePasswordBody(data.currentPassword, data.newPassword))
      if (relogin) {
        // Mot de passe changé, aucune session ouverte : connexion (navigation complète)
        window.location.assign(RELOGIN_AFTER_CHANGE_URL)
        return
      }
      reset()
      setDone(true)
    } catch (err) {
      setServerError(changeErrorMessage(err))
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Changer mon mot de passe</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Mot de passe actuel</Label>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              aria-invalid={!!errors.currentPassword}
              {...register("currentPassword")}
            />
            {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">Nouveau mot de passe</Label>
            <PasswordInput
              id="newPassword"
              placeholder="8 caractères minimum, au moins un chiffre"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              {...register("newPassword")}
            />
            {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
            <PasswordInput
              id="confirmPassword"
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
          {done && (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <p>Mot de passe modifié. Vos autres sessions ont été déconnectées ; un email de confirmation vous a été envoyé.</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Changer le mot de passe
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
