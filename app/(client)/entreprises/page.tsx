import type { Metadata } from "next"
import { Building2, CalendarCheck, CreditCard, Headset } from "lucide-react"
import { EntreprisesForm } from "@/components/EntreprisesForm"

export const metadata: Metadata = {
  title: "Transport professionnel pour les entreprises — Transport24h",
  description:
    "Solutions de transport sur-mesure pour les professionnels. Réservations sans paiement immédiat, compte dédié, tarifs préférentiels.",
}

const FEATURES = [
  {
    icon: CreditCard,
    title: "Pas de paiement à la réservation",
    description:
      "Vos courses sont confirmées immédiatement. La facturation est gérée séparément selon les modalités convenues.",
  },
  {
    icon: CalendarCheck,
    title: "Réservations prioritaires",
    description:
      "Accédez à des créneaux dédiés et bénéficiez d'une prise en charge prioritaire pour vos demandes urgentes.",
  },
  {
    icon: Building2,
    title: "Compte entreprise centralisé",
    description:
      "Gérez toutes vos courses depuis un espace unique. Historique, factures et suivi en temps réel.",
  },
  {
    icon: Headset,
    title: "Interlocuteur dédié",
    description:
      "Un conseiller Transport24h vous accompagne pour organiser vos opérations et répondre à vos besoins spécifiques.",
  },
]

export default function EntreprisesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      {/* Hero */}
      <div className="mb-14 text-center">
        <span className="mb-3 inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Espace Entreprises
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Transport professionnel<br className="hidden sm:block" /> pour votre activité
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Simplifiez la logistique de votre entreprise avec un compte dédié, des réservations
          sans friction et une facturation adaptée à vos processus internes.
        </p>
      </div>

      {/* Features */}
      <div className="mb-16 grid gap-6 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex gap-4 rounded-xl border border-border/60 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Formulaire contact */}
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold">Contactez-nous</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Décrivez vos besoins et nous vous proposerons une offre adaptée.
          </p>
        </div>
        <EntreprisesForm />
      </div>
    </div>
  )
}
