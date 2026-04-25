"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { Loader2, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { register, ApiError } from "@/lib/api"
import { BackButton } from "@/components/BackButton"
import { useState } from "react"

const registerSchema = z
  .object({
    firstName: z.string().min(2, { error: "Prénom trop court" }).trim(),
    lastName: z.string().min(2, { error: "Nom trop court" }).trim(),
    email: z.string().email({ error: "Adresse e-mail invalide" }).trim(),
    phone: z
      .string()
      .trim()
      .refine((v) => !v || /^(0|\+33)[1-9][0-9]{8}$/.test(v), {
        message: "Numéro invalide — ex : 0612345678 ou +33612345678",
      })
      .optional(),
    password: z
      .string()
      .min(8, { error: "8 caractères minimum" })
      .regex(/[0-9]/, { message: "Le mot de passe doit contenir au moins un chiffre" }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    setServerError(null)
    try {
      await register({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        password: data.password,
        phone: data.phone || undefined,
      })
      router.push("/login?registered=1")
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setServerError("Un compte existe déjà avec cet e-mail.")
      } else if (err instanceof ApiError) {
        setServerError(err.message)
      } else {
        setServerError("Une erreur est survenue. Veuillez réessayer.")
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute top-4 left-4">
        <BackButton href="/login" />
      </div>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary">
            <Truck className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">Transport24h</h1>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-center text-lg font-semibold">
              Créer un compte
            </h2>
            <p className="text-center text-sm text-muted-foreground">
              Réservez et suivez vos transports en ligne
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Prénom / Nom */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    placeholder="Jean"
                    autoComplete="given-name"
                    aria-invalid={!!errors.firstName}
                    {...registerField("firstName")}
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
                    autoComplete="family-name"
                    aria-invalid={!!errors.lastName}
                    {...registerField("lastName")}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive">
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              {/* E-mail */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.fr"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  {...registerField("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Téléphone */}
              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  Téléphone{" "}
                  <span className="text-xs text-muted-foreground">
                    (optionnel)
                  </span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="06 12 34 56 78"
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                  {...registerField("phone")}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              {/* Mot de passe */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="8 caractères minimum"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  {...registerField("password")}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirmation */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirmPassword}
                  {...registerField("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">
                    {errors.confirmPassword.message}
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
                {isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Créer mon compte
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Déjà un compte ?{" "}
              <Link
                href="/login"
                className="text-primary underline-offset-4 hover:underline"
              >
                Se connecter
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
