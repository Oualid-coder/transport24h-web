"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { acceptInvitation } from "@/lib/api"
import { acceptInvitationErrorMessage, acceptTermsField, buildAcceptInvitationBody } from "@/lib/register"
import { TermsCheckbox } from "@/components/TermsCheckbox"
import { stripTokenFromAddressBar } from "@/lib/url-token"

function AcceptInvitationContent() {
  const sp = useSearchParams()
  const router = useRouter()
  // Jeton figé au premier rendu : il est ensuite retiré de l'URL (stripTokenFromAddressBar)
  const [token] = useState(() => sp.get("token") ?? "")
  useEffect(() => {
    stripTokenFromAddressBar()
  }, [])

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [termsError, setTermsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <p className="text-sm text-destructive">Lien d&apos;invitation invalide ou manquant.</p>
      </div>
    )
  }

  const validate = (): string | null => {
    if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères."
    if (!/\d/.test(password)) return "Le mot de passe doit contenir au moins un chiffre."
    if (password !== confirm) return "Les mots de passe ne correspondent pas."
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    // Même règle que l'inscription : case obligatoire (z.literal(true)), même message
    const terms = acceptTermsField.safeParse(acceptTerms)
    setError(validationError)
    setTermsError(terms.success ? null : terms.error.issues[0].message)
    if (validationError || !terms.success) return
    setLoading(true)
    try {
      // terms_accepted + terms_version ; jamais de date, posée par le serveur
      await acceptInvitation(buildAcceptInvitationBody(token, password, acceptTerms))
      setSuccess(true)
    } catch (err) {
      setError(acceptInvitationErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <CheckCircle className="mx-auto mb-4 size-12 text-primary" />
        <h1 className="text-xl font-bold">Compte activé</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre compte a été activé avec succès. Vous pouvez maintenant vous connecter.
        </p>
        <Button className="mt-6 w-full" onClick={() => router.push("/login")}>
          Se connecter
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Activer votre compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez un mot de passe pour accéder à votre espace.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Nouveau mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="8 caractères minimum, au moins un chiffre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Répétez le mot de passe"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <TermsCheckbox
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              disabled={loading}
              error={termsError ?? undefined}
            />

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Activer mon compte
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  )
}
