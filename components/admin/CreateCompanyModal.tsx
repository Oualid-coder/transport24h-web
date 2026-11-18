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
import { createCompany, ApiError } from "@/lib/api"
import type { Company } from "@/lib/types"

export function CreateCompanyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (company: Company) => void
}) {
  const [fields, setFields] = useState({ name: "", contact_email: "" })
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; contact_email?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const set =
    (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((prev) => ({ ...prev, [k]: e.target.value }))

  const validate = (): boolean => {
    const e: { name?: string; contact_email?: string } = {}
    if (!fields.name.trim()) e.name = "Requis"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.contact_email.trim()))
      e.contact_email = "Email invalide"
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  const mutation = useMutation({
    mutationFn: () =>
      createCompany({ name: fields.name.trim(), contact_email: fields.contact_email.trim() }),
    onSuccess: (company) => {
      onCreated(company)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setServerError("Une entreprise avec cet email existe déjà.")
      } else {
        setServerError(err instanceof ApiError ? err.message : "Erreur lors de la création.")
      }
    },
  })

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
          <DialogTitle className="font-semibold">Créer une entreprise</DialogTitle>
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
          <div className="space-y-1.5">
            <label htmlFor="company-name" className="text-xs font-medium text-muted-foreground">
              Raison sociale
            </label>
            <Input
              id="company-name"
              placeholder="ACME SAS"
              value={fields.name}
              onChange={set("name")}
              aria-invalid={!!fieldErrors.name}
            />
            {fieldErrors.name && (
              <p className="text-xs text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="company-email" className="text-xs font-medium text-muted-foreground">
              Email du contact
            </label>
            <Input
              id="company-email"
              type="email"
              placeholder="contact@acme.fr"
              value={fields.contact_email}
              onChange={set("contact_email")}
              aria-invalid={!!fieldErrors.contact_email}
            />
            {fieldErrors.contact_email && (
              <p className="text-xs text-destructive">{fieldErrors.contact_email}</p>
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
              disabled={mutation.isPending}
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Créer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
