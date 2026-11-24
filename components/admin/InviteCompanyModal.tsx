"use client"

import { useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { inviteCompany } from "@/lib/api"
import {
  INVITE_EMAIL_MAX,
  INVITE_NAME_MAX,
  buildInviteBody,
  inviteErrorMessage,
  validateInviteForm,
  type InviteFormErrors,
  type InviteFormValues,
} from "@/lib/company-invitation"

const EMPTY: InviteFormValues = { email: "", firstName: "", lastName: "" }

// Invitation du contact d'une entreprise : crée son compte (inactif) et lui envoie le lien
// d'activation. company = null : fenêtre fermée.
export function InviteCompanyModal({
  company,
  onClose,
  onInvited,
}: {
  company: { id: string; name: string } | null
  onClose: () => void
  onInvited: (email: string) => void
}) {
  const [fields, setFields] = useState<InviteFormValues>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<InviteFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  // Un seul envoi à la fois : un double clic avant le rendu suivant est ignoré.
  const inFlight = useRef(false)

  // Nom gardé pendant l'animation de fermeture (company repasse à null avant la fin)
  const [shownName, setShownName] = useState(company?.name ?? "")
  if (company && company.name !== shownName) setShownName(company.name)

  const set =
    (k: keyof InviteFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFields((prev) => ({ ...prev, [k]: e.target.value }))
      setFieldErrors((prev) => ({ ...prev, [k]: undefined }))
    }

  const reset = () => {
    setFields(EMPTY)
    setFieldErrors({})
    setServerError(null)
  }

  const mutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: InviteFormValues }) =>
      inviteCompany(id, buildInviteBody(values)),
    onSuccess: (_data, { values }) => {
      onInvited(buildInviteBody(values).email)
      reset()
    },
    onError: (err) => setServerError(inviteErrorMessage(err)),
    onSettled: () => {
      inFlight.current = false
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!company || inFlight.current) return
    const errors = validateInviteForm(fields)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setServerError(null)
    inFlight.current = true
    mutation.mutate({ id: company.id, values: fields })
  }

  const close = () => {
    if (mutation.isPending) return
    reset()
    onClose()
  }

  const field = (
    k: keyof InviteFormValues,
    id: string,
    label: string,
    props: React.ComponentProps<typeof Input>,
  ) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        value={fields[k]}
        onChange={set(k)}
        disabled={mutation.isPending}
        aria-invalid={!!fieldErrors[k]}
        {...props}
      />
      {fieldErrors[k] && <p className="text-xs text-destructive">{fieldErrors[k]}</p>}
    </div>
  )

  return (
    <Dialog
      open={company !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) close()
      }}
    >
      <DialogContent showCloseButton={false} className="max-w-md gap-0 overflow-hidden p-0 bg-background">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="font-semibold">Inviter le contact</DialogTitle>
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

        <form onSubmit={handleSubmit} noValidate className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            {shownName} : un email avec un lien d&apos;activation (valable 72 h) sera envoyé à ce contact.
          </p>

          {field("email", "invite-email", "Email du contact", {
            type: "email",
            placeholder: "contact@acme.fr",
            autoComplete: "off",
            maxLength: INVITE_EMAIL_MAX,
          })}
          <div className="grid grid-cols-2 gap-3">
            {field("firstName", "invite-first-name", "Prénom", { maxLength: INVITE_NAME_MAX })}
            {field("lastName", "invite-last-name", "Nom", { maxLength: INVITE_NAME_MAX })}
          </div>

          {serverError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={mutation.isPending} onClick={close}>
              Plus tard
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending} aria-busy={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              {mutation.isPending ? "Envoi…" : "Envoyer l'invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
