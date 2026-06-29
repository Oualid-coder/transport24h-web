import Link from "next/link"
import { BackButton } from "@/components/BackButton"

export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <BackButton href="/" />
      </div>

      <h1 className="text-3xl font-bold">Mentions légales</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans
        l&apos;économie numérique (LCEN).
      </p>

      <div className="mt-10 space-y-10 text-sm">

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Éditeur du site</h2>
          <div className="rounded-lg border border-border/50 bg-card p-5 space-y-2">
            <Row label="Dénomination sociale" value="TRANSPORT24H.FR" />
            <Row label="Forme juridique" value="Société par actions simplifiée (SAS)" />
            <Row label="Capital social" value="5 400,00 €" />
            <Row label="Siège social" value="27 rue de Tanger, 75019 Paris, France" />
            <Row label="SIREN" value="992 485 623" />
            <Row label="SIRET" value="992 485 623 00019" />
            <Row label="N° TVA intracommunautaire" value="FR74 992 485 623" />
            <Row label="Directeur de la publication" value="Ahmed Jabnoun" />
            <Row
              label="Contact"
              value="contact@transport24h.fr"
              link="mailto:contact@transport24h.fr"
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Hébergeur</h2>
          <div className="rounded-lg border border-border/50 bg-card p-5 space-y-2">
            <Row label="Raison sociale" value="Hetzner Online GmbH" />
            <Row label="Adresse" value="Industriestr. 25, 91710 Gunzenhausen, Allemagne" />
            <Row
              label="Site web"
              value="www.hetzner.com"
              link="https://www.hetzner.com"
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Propriété intellectuelle</h2>
          <p className="text-muted-foreground leading-relaxed">
            L&apos;ensemble des éléments constituant le site transport24h.fr (textes,
            graphismes, logiciels, photographies, images, sons, plans, noms, logos,
            marques, créations et œuvres protégeables diverses, bases de données, etc.)
            sont la propriété exclusive de TRANSPORT24H.FR ou de ses partenaires, et
            sont protégés par les lois françaises et internationales relatives à la
            propriété intellectuelle.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Toute reproduction, représentation, modification, publication ou adaptation
            de tout ou partie des éléments du site, quel que soit le moyen ou le procédé
            utilisé, est interdite sans l&apos;autorisation préalable et écrite de
            TRANSPORT24H.FR.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Données personnelles</h2>
          <p className="text-muted-foreground leading-relaxed">
            TRANSPORT24H.FR traite des données à caractère personnel dans le cadre de
            l&apos;exploitation du présent site. Ces traitements sont effectués conformément
            au Règlement général sur la protection des données (RGPD — Règlement UE
            2016/679) et à la loi n° 78-17 du 6 janvier 1978 relative à
            l&apos;informatique, aux fichiers et aux libertés.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Pour plus d&apos;informations sur la gestion de vos données et l&apos;exercice
            de vos droits, consultez notre{" "}
            <Link
              href="/politique-de-confidentialite"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              politique de confidentialité
            </Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Conditions générales de vente</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les conditions contractuelles applicables aux prestations de transport sont
            détaillées dans nos{" "}
            <Link
              href="/cgv"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              conditions générales de vente
            </Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Liens hypertextes</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le site transport24h.fr peut contenir des liens vers d&apos;autres sites.
            TRANSPORT24H.FR n&apos;exerce aucun contrôle sur ces sites tiers et décline
            toute responsabilité quant à leur contenu ou à leur politique de
            confidentialité.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Droit applicable</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les présentes mentions légales sont régies par le droit français. Tout litige
            relatif à leur interprétation ou à leur exécution relève de la compétence
            exclusive des tribunaux français.
          </p>
        </section>

      </div>
    </div>
  )
}

function Row({
  label,
  value,
  link,
}: {
  label: string
  value: string
  link?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <span className="w-56 shrink-0 text-muted-foreground">{label}</span>
      {link ? (
        <a href={link} className="font-medium text-primary hover:underline">
          {value}
        </a>
      ) : (
        <span className="font-medium">{value}</span>
      )}
    </div>
  )
}
