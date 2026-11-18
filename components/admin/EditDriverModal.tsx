"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { updateDriver, ApiError } from "@/lib/api"
import type { Driver } from "@/lib/types"

export function EditDriverModal({
  open,
  driver,
  onClose,
  onUpdated,
}: {
  open: boolean
  driver: Driver | null
  onClose: () => void
  onUpdated: () => void
}) {
  const [fields, setFields] = useState({
    first_name: driver?.first_name ?? "",
    last_name: driver?.last_name ?? "",
    email: driver?.email ?? "",
    phone: driver?.phone ?? "",
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof fields, string>>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      if (!driver) return Promise.reject(new Error("Aucun chauffeur sélectionné"))
      return updateDriver(driver.id, fields)
    },
    onSuccess: () => onUpdated(),
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Erreur lors de la mise à jour.")
    },
  })

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
        if (!isOpen) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-0 overflow-hidden p-0 bg-background"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="font-semibold">Modifier le chauffeur</DialogTitle>
          <DialogClose
            render={
              <button
                disabled={mutation.isPending}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                aria-label="Fermer"
              />
            }
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-first-name" className="text-xs font-medium text-muted-foreground">
                Prénom
              </label>
              <Input
                id="edit-first-name"
                placeholder="Jean"
                value={fields.first_name}
                onChange={set("first_name")}
                aria-invalid={!!fieldErrors.first_name}
                aria-describedby={fieldErrors.first_name ? "edit-first-name-error" : undefined}
              />
              {fieldErrors.first_name && (
                <p id="edit-first-name-error" className="text-xs text-destructive">
                  {fieldErrors.first_name}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-last-name" className="text-xs font-medium text-muted-foreground">
                Nom
              </label>
              <Input
                id="edit-last-name"
                placeholder="Dupont"
                value={fields.last_name}
                onChange={set("last_name")}
                aria-invalid={!!fieldErrors.last_name}
                aria-describedby={fieldErrors.last_name ? "edit-last-name-error" : undefined}
              />
              {fieldErrors.last_name && (
                <p id="edit-last-name-error" className="text-xs text-destructive">
                  {fieldErrors.last_name}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-email" className="text-xs font-medium text-muted-foreground">
              Adresse e-mail
            </label>
            <Input
              id="edit-email"
              type="email"
              placeholder="jean.dupont@exemple.fr"
              value={fields.email}
              onChange={set("email")}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "edit-email-error" : undefined}
            />
            {fieldErrors.email && (
              <p id="edit-email-error" className="text-xs text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-phone" className="text-xs font-medium text-muted-foreground">
              Téléphone
            </label>
            <Input
              id="edit-phone"
              type="tel"
              placeholder="06 12 34 56 78"
              value={fields.phone}
              onChange={set("phone")}
              aria-invalid={!!fieldErrors.phone}
              aria-describedby={fieldErrors.phone ? "edit-phone-error" : undefined}
            />
            {fieldErrors.phone && (
              <p id="edit-phone-error" className="text-xs text-destructive">
                {fieldErrors.phone}
              </p>
            )}
          </div>

          {serverError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
