"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { createDriver, ApiError } from "@/lib/api"
import { driverCreatedMessage } from "@/lib/invitation-resend"
import type { DriverCreated } from "@/lib/types"

export function CreateDriverModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [fields, setFields] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof fields, string>>>({})
  const [result, setResult] = useState<DriverCreated | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => createDriver(fields),
    onSuccess: (data) => {
      setResult(data)
      onCreated()
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Erreur lors de la création.")
    },
  })

  // Fermeture : formulaire et confirmation remis à zéro (sinon la confirmation précédente
  // réapparaîtrait à la prochaine ouverture).
  const handleClose = () => {
    setResult(null)
    setFields({ email: "", first_name: "", last_name: "", phone: "" })
    setFieldErrors({})
    setServerError(null)
    mutation.reset()
    onClose()
  }

  const set =
    (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((prev) => ({ ...prev, [k]: e.target.value }))

  const validate = (): boolean => {
    const e: Partial<Record<keyof typeof fields, string>> = {}
    if (!fields.first_name.trim()) e.first_name = "Requis"
    if (!fields.last_name.trim()) e.last_name = "Requis"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) e.email = "Email invalide"
    if (!/^(0|\+33)[1-9][0-9]{8}$/.test(fields.phone.trim()))
      e.phone = "Numéro invalide — ex : 0612345678 ou +33612345678"
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setServerError(null)
    mutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && mutation.isPending) return
        if (!isOpen) handleClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-0 overflow-hidden p-0 bg-background"
      >
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="font-semibold">
            {result ? "Compte créé" : "Ajouter un chauffeur CDI"}
          </DialogTitle>
          <DialogClose
            render={
              <button
                disabled={mutation.isPending}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 max-lg:-m-2.5 max-lg:p-3.5"
                aria-label="Fermer"
              />
            }
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        {result ? (
          /* ── État succès : invitation envoyée (aucun mot de passe affiché) ── */
          <div className="space-y-4 p-5">
            {(() => {
              const msg = driverCreatedMessage(result)
              return msg.sent ? (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600"
                >
                  <CheckCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{msg.text}</p>
                </div>
              ) : (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>{msg.text}</p>
                </div>
              )
            })()}
            <p className="text-sm text-muted-foreground">
              {result.first_name} {result.last_name} ·{" "}
              <span className="break-all font-mono text-xs">{result.email}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Le chauffeur choisit lui-même son mot de passe en ouvrant le lien reçu. Son compte
              apparaît dans « Invitations en attente » jusqu&apos;à l&apos;activation.
            </p>
            <Button className="w-full" onClick={handleClose}>
              Fermer
            </Button>
          </div>
        ) : (
          /* ── Formulaire ── */
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="cdi-first-name" className="text-xs font-medium text-muted-foreground">
                  Prénom
                </label>
                <Input
                  id="cdi-first-name"
                  placeholder="Jean"
                  value={fields.first_name}
                  onChange={set("first_name")}
                  aria-invalid={!!fieldErrors.first_name}
                  aria-describedby={fieldErrors.first_name ? "cdi-first-name-error" : undefined}
                />
                {fieldErrors.first_name && (
                  <p id="cdi-first-name-error" className="text-xs text-destructive">{fieldErrors.first_name}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="cdi-last-name" className="text-xs font-medium text-muted-foreground">
                  Nom
                </label>
                <Input
                  id="cdi-last-name"
                  placeholder="Dupont"
                  value={fields.last_name}
                  onChange={set("last_name")}
                  aria-invalid={!!fieldErrors.last_name}
                  aria-describedby={fieldErrors.last_name ? "cdi-last-name-error" : undefined}
                />
                {fieldErrors.last_name && (
                  <p id="cdi-last-name-error" className="text-xs text-destructive">{fieldErrors.last_name}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cdi-email" className="text-xs font-medium text-muted-foreground">
                Adresse e-mail
              </label>
              <Input
                id="cdi-email"
                type="email"
                placeholder="jean.dupont@exemple.fr"
                value={fields.email}
                onChange={set("email")}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "cdi-email-error" : undefined}
              />
              {fieldErrors.email && (
                <p id="cdi-email-error" className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cdi-phone" className="text-xs font-medium text-muted-foreground">
                Téléphone
              </label>
              <Input
                id="cdi-phone"
                type="tel"
                placeholder="06 12 34 56 78"
                value={fields.phone}
                onChange={set("phone")}
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={fieldErrors.phone ? "cdi-phone-error" : undefined}
              />
              {fieldErrors.phone && (
                <p id="cdi-phone-error" className="text-xs text-destructive">{fieldErrors.phone}</p>
              )}
            </div>
            {serverError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Créer le compte
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
