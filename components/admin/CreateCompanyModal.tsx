"use client"

import { useRef, useState } from "react"
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
import { createCompany } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"
import type { CreatedCompany } from "@/lib/types"

export function CreateCompanyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (company: CreatedCompany) => void
}) {
  // L'API ne stocke pas d'email sur l'entreprise : l'email du contact est saisi à l'invitation.
  const [fields, setFields] = useState({ name: "" })
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  // Un seul envoi à la fois : un double clic ne crée pas deux entreprises.
  const inFlight = useRef(false)

  const set =
    (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((prev) => ({ ...prev, [k]: e.target.value }))

  const validate = (): boolean => {
    const e: { name?: string } = {}
    if (!fields.name.trim()) e.name = "Requis"
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  const mutation = useMutation({
    mutationFn: () => createCompany({ name: fields.name.trim() }),
    onSuccess: (company) => {
      setFields({ name: "" })
      onCreated(company)
    },
    onError: (err) => {
      setServerError(errorMessage(err, "Erreur lors de la création."))
    },
    onSettled: () => {
      inFlight.current = false
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlight.current || !validate()) return
    setServerError(null)
    inFlight.current = true
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

          <p className="text-xs text-muted-foreground">
            Vous saisirez ensuite l&apos;email, le prénom et le nom du contact à inviter.
          </p>

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
