import Link from "next/link"
import { ADDRESS_PAID_MESSAGE } from "@/lib/booking-status"

// Course payée : l'adresse ne se modifie plus en ligne (409 de l'API) → message et moyens de contact.
export function AddressPaidNotice({ className }: { className?: string }) {
  return (
    <p className={className}>
      {ADDRESS_PAID_MESSAGE}{" "}
      <Link href="/contact" className="font-medium text-foreground underline underline-offset-2">
        Formulaire de contact
      </Link>
      {" ou "}
      <a href="mailto:contact@transport24h.fr" className="font-medium text-foreground underline underline-offset-2">
        contact@transport24h.fr
      </a>
    </p>
  )
}
