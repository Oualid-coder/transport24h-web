import Link from "next/link"
import { Clock } from "lucide-react"
import { BackButton } from "@/components/BackButton"

export default function CGVPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <BackButton href="/" />
      </div>

      <h1 className="text-3xl font-bold">Conditions générales de vente</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : juin 2026
      </p>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-5 py-4">
        <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="font-medium text-foreground">Document en cours de finalisation</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Les conditions générales de vente sont en cours de rédaction avec notre équipe.
            Le document contractuel complet sera publié prochainement.
          </p>
        </div>
      </div>

      <div className="mt-10 space-y-10 text-sm">

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Objet</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les présentes conditions générales de vente (CGV) régissent les relations
            contractuelles entre la société TRANSPORT24H.FR (SAS, SIREN 992 485 623,
            27 rue de Tanger, 75019 Paris, France) et toute personne physique ou morale
            (ci-après «&nbsp;le Client&nbsp;») souhaitant bénéficier des services de
            transport proposés sur le site transport24h.fr.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Toute réservation implique l&apos;acceptation sans réserve des présentes CGV.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Services proposés</h2>
          <p className="text-muted-foreground leading-relaxed">
            TRANSPORT24H.FR propose des services de transport de marchandises et de
            déménagement, incluant la mise à disposition de véhicules utilitaires
            (6 m³, 12 m³ ou 20 m³) avec chauffeur professionnel, et en option
            des manutentionnaires.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Tarifs et TVA</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les prix affichés sur le site sont exprimés en euros hors taxes (HT).
            La TVA au taux légal en vigueur (20 %) est ajoutée lors de la confirmation
            de réservation. TRANSPORT24H.FR est assujettie à la TVA — numéro
            intracommunautaire : FR74 992 485 623.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Les tarifs sont calculés en temps réel selon la distance du trajet, le volume
            du véhicule sélectionné et le nombre de manutentionnaires. Le prix affiché est
            le prix définitif — aucun supplément n&apos;est facturé sans accord préalable du
            Client.
          </p>
          <Placeholder />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Réservation et confirmation</h2>
          <Placeholder />
          <p className="text-muted-foreground leading-relaxed">
            [À compléter — processus de réservation en ligne, délai de confirmation par
            notre équipe, modalités de prise en charge]
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Paiement</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le paiement s&apos;effectue exclusivement par carte bancaire via la plateforme
            sécurisée Stripe. La carte du Client est enregistrée lors de la réservation et
            débitée 24 heures avant la date de transport prévue. Aucun prélèvement
            n&apos;est effectué au moment de la réservation.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            TRANSPORT24H.FR ne stocke aucune donnée bancaire — celles-ci sont gérées
            intégralement par Stripe (certifié PCI DSS).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Annulation et remboursement</h2>
          <Placeholder />
          <p className="text-muted-foreground leading-relaxed">
            [À compléter — conditions et délais d&apos;annulation, politique de
            remboursement selon le délai avant le transport]
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Responsabilités</h2>
          <Placeholder />
          <p className="text-muted-foreground leading-relaxed">
            [À compléter — responsabilités respectives du prestataire et du Client,
            assurance transport, cas de force majeure]
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Données personnelles</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les données personnelles collectées dans le cadre de la réservation sont
            traitées conformément à notre{" "}
            <Link
              href="/politique-de-confidentialite"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">9. Droit applicable et litiges</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les présentes CGV sont soumises au droit français. En cas de litige, et après
            tentative de résolution amiable, les tribunaux français seront seuls compétents.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Conformément aux dispositions du Code de la consommation, vous pouvez recourir
            gratuitement à un médiateur de la consommation. [À compléter — coordonnées
            du médiateur retenu]
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">10. Contact</h2>
          <p className="text-muted-foreground leading-relaxed">
            Pour toute question relative aux présentes CGV :{" "}
            <a
              href="mailto:contact@transport24h.fr"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              contact@transport24h.fr
            </a>
          </p>
        </section>

      </div>

      <div className="mt-10 border-t border-border/50 pt-6 text-xs text-muted-foreground">
        Voir aussi les{" "}
        <Link href="/mentions-legales" className="text-primary hover:underline">
          mentions légales
        </Link>{" "}
        et la{" "}
        <Link
          href="/politique-de-confidentialite"
          className="text-primary hover:underline"
        >
          politique de confidentialité
        </Link>
        .
      </div>
    </div>
  )
}

function Placeholder() {
  return (
    <div className="rounded-md border border-border/50 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
      Section en cours de finalisation
    </div>
  )
}
