"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { CheckCircle2, Loader2, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { login, ApiError } from "@/lib/api"

const loginSchema = z.object({
  email: z.email({ error: "Adresse e-mail invalide" }),
  password: z.string().min(1, { error: "Mot de passe requis" }),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginContent() {
  const sp = useSearchParams()
  const redirectParam = sp.get("redirect")
  const registered = sp.get("registered") === "1"

  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    try {
      // redirectParam est transmis au serveur — le 302 cible déjà la bonne URL
      const result = await login(data.email, data.password, redirectParam ?? undefined)
      window.location.href = result.redirect_to
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setServerError("Email ou mot de passe incorrect.")
      } else {
        setServerError("Une erreur est survenue. Veuillez réessayer.")
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary">
            <Truck className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">Transport24h</h1>
        </div>

        {/* Bannière inscription réussie */}
        {registered && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            Compte créé ! Connectez-vous maintenant.
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-center text-lg font-semibold">Connexion</h2>
            <p className="text-center text-sm text-muted-foreground">
              Accédez à votre espace personnel
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {serverError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {serverError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Se connecter
              </Button>
            </form>

            <div className="mt-5 space-y-1.5 text-center text-xs text-muted-foreground">
              <p>
                Pas encore de compte ?{" "}
                <Link
                  href="/register"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Créer un compte client
                </Link>
              </p>
              <p>
                <Link
                  href="/partners"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Devenir chauffeur partenaire
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
