import Link from "next/link"
import { Clock } from "lucide-react"
import { BackButton } from "@/components/BackButton"

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <BackButton href="/" />
      </div>

      <h1 className="text-3xl font-bold">Politique de confidentialité</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : juin 2026
      </p>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 px-5 py-4">
        <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="font-medium text-foreground">Document en cours de finalisation</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Cette politique de confidentialité est en cours de rédaction avec notre équipe.
            Les informations ci-dessous constituent le cadre général ; le document complet
            sera publié prochainement.
          </p>
        </div>
      </div>

      <div className="mt-10 space-y-10 text-sm">

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Responsable du traitement</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le responsable du traitement des données à caractère personnel collectées sur
            le site transport24h.fr est :
          </p>
          <div className="rounded-lg border border-border/50 bg-card p-5 space-y-2">
            <InfoRow label="Société" value="TRANSPORT24H.FR" />
            <InfoRow label="Siège social" value="27 rue de Tanger, 75019 Paris" />
            <InfoRow label="SIREN" value="992 485 623" />
            <InfoRow
              label="Contact"
              value="contact@transport24h.fr"
              link="mailto:contact@transport24h.fr"
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Données collectées</h2>
          <Placeholder />
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              Données d&apos;identification : nom, prénom, adresse e-mail, numéro de
              téléphone
            </li>
            <li>
              Données de transport : adresses de départ et d&apos;arrivée, créneaux
              horaires
            </li>
            <li>
              Données de paiement : gérées exclusivement par Stripe — TRANSPORT24H.FR
              ne stocke aucune donnée bancaire
            </li>
            <li>
              Données de navigation : adresse IP, type de navigateur, pages visitées
              [à préciser]
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Finalités du traitement</h2>
          <Placeholder />
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>Gestion et exécution des réservations de transport</li>
            <li>Traitement des paiements via Stripe</li>
            <li>
              Communications liées à vos courses (confirmation, rappel, suivi)
            </li>
            <li>Amélioration de nos services</li>
            <li>Respect de nos obligations légales et fiscales</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Durée de conservation</h2>
          <Placeholder />
          <p className="text-muted-foreground leading-relaxed">
            [À compléter — durées précises par catégorie de données]
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Vos droits</h2>
          <p className="text-muted-foreground leading-relaxed">
            Conformément au RGPD (Règlement UE 2016/679), vous disposez des droits
            suivants sur vos données personnelles :
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>Droit d&apos;accès (art. 15)</li>
            <li>Droit de rectification (art. 16)</li>
            <li>Droit à l&apos;effacement (art. 17)</li>
            <li>Droit à la limitation du traitement (art. 18)</li>
            <li>Droit à la portabilité (art. 20)</li>
            <li>Droit d&apos;opposition (art. 21)</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Pour exercer ces droits, contactez-nous à{" "}
            <a
              href="mailto:contact@transport24h.fr"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              contact@transport24h.fr
            </a>
            . Vous pouvez également introduire une réclamation auprès de la{" "}
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              CNIL
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le site transport24h.fr n&apos;utilise aucun cookie de mesure d&apos;audience,
            publicitaire ou de traçage commercial. Aucun consentement préalable n&apos;est
            requis pour les catégories de cookies suivantes, conformément aux
            recommandations de la CNIL.
          </p>
          <p className="font-medium text-foreground">
            Cookies strictement nécessaires au fonctionnement du service :
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">access_token</span>
              {" "}— maintien de la session utilisateur connectée
            </li>
            <li>
              <span className="font-medium text-foreground">user_role</span>
              {" "}— identification du type de compte (client, chauffeur,
              administrateur) pour l&apos;affichage de l&apos;interface adaptée
            </li>
            <li>
              <span className="font-medium text-foreground">refresh_token</span>
              {" "}— renouvellement automatique de la session
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Ces cookies sont indispensables à l&apos;utilisation du site (connexion,
            réservation, paiement) et ne peuvent être désactivés sans empêcher le
            fonctionnement du service.
          </p>
          <p className="font-medium text-foreground">
            Cookies tiers liés au paiement sécurisé :
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Lors du paiement, notre prestataire Stripe (certifié PCI DSS) dépose des
            cookies techniques ({" "}
            <span className="font-medium text-foreground">__stripe_mid</span>,{" "}
            <span className="font-medium text-foreground">__stripe_sid</span>,{" "}
            <span className="font-medium text-foreground">m</span>
            {" "}) nécessaires à la sécurisation de la transaction et à la prévention de
            la fraude. Ces cookies ne sont déposés que sur la page de paiement.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Vous pouvez configurer votre navigateur pour refuser les cookies, mais cela
            pourrait empêcher l&apos;utilisation de certaines fonctionnalités du site,
            notamment la réservation et le paiement en ligne.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Sécurité</h2>
          <p className="text-muted-foreground leading-relaxed">
            TRANSPORT24H.FR met en œuvre des mesures techniques et organisationnelles
            appropriées pour protéger vos données contre tout accès non autorisé,
            toute perte ou divulgation. Les communications avec notre plateforme sont
            chiffrées via HTTPS.
          </p>
        </section>

      </div>

      <div className="mt-10 border-t border-border/50 pt-6 text-xs text-muted-foreground">
        Pour toute question :{" "}
        <a
          href="mailto:contact@transport24h.fr"
          className="text-primary hover:underline"
        >
          contact@transport24h.fr
        </a>{" "}
        — Voir aussi les{" "}
        <Link href="/mentions-legales" className="text-primary hover:underline">
          mentions légales
        </Link>{" "}
        et les{" "}
        <Link href="/cgv" className="text-primary hover:underline">
          CGV
        </Link>.
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

function InfoRow({
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
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
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
