import type { PaymentStatus } from "@/lib/types"

// Badge de statut de paiement de la carte admin.
// Valeurs de l'API : paid (normalisé depuis succeeded), pending, failed, refunded, none.
export const PAYMENT_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  paid: {
    label: "Payé",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  pending: {
    label: "Paiement en attente",
    className: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  },
  failed: {
    label: "Paiement refusé",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  refunded: {
    label: "Remboursé",
    className: "border-border bg-muted text-muted-foreground",
  },
  none: {
    label: "Non payé",
    className: "border-border bg-muted text-muted-foreground",
  },
}

function isPaymentStatus(s: string): s is PaymentStatus {
  return Object.hasOwn(PAYMENT_CONFIG, s)
}

// paymentBadge ne plante jamais : toute valeur inconnue de l'API retombe sur « Non payé ».
export function paymentBadge(status: string | null | undefined): { label: string; className: string } {
  return typeof status === "string" && isPaymentStatus(status) ? PAYMENT_CONFIG[status] : PAYMENT_CONFIG.none
}
