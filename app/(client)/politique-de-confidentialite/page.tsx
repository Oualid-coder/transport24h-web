import Link from "next/link"
import { Clock } from "lucide-react"
import { BackButton } from "@/components/BackButton"
import { TERMS_VERSION, formatTermsDate } from "@/lib/legal"

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <BackButton href="/" />
      </div>

      <h1 className="text-3xl font-bold">Politique de confidentialité</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : {formatTermsDate(TERMS_VERSION)}
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
              Données de paiement : la carte est saisie dans des champs fournis par
              Stripe — TRANSPORT24H.FR ne stocke ni le numéro de carte, ni sa date
              d&apos;expiration, ni son cryptogramme ; sont conservés les identifiants
              techniques Stripe (client, moyen de paiement, transaction), le montant et
              le statut du paiement
            </li>
            <li>
              Preuve d&apos;acceptation : à l&apos;inscription, date et version des CGV et
              de la politique de confidentialité acceptées (case certifiant également
              avoir 18 ans ou plus)
            </li>
            <li>
              Photos d&apos;état des lieux : photos prises par le chauffeur avant et
              après la prestation
            </li>
            <li>
              Candidature de chauffeur partenaire : nom, prénom, adresse e-mail, numéro
              de téléphone, numéro SIRET, type de camion et justificatifs transmis
              (extrait Kbis, licence mère, attestation d&apos;assurance responsabilité
              civile professionnelle, attestation de vigilance URSSAF)
            </li>
            <li>
              Formulaire de contact : adresse e-mail, objet et contenu du message
            </li>
            <li>
              Journaux techniques : pour chaque requête adressée à notre serveur
              d&apos;application, adresse IP, méthode et adresse de la requête, code de
              réponse et durée de traitement ; selon les opérations, identifiant de
              votre compte et de vos réservations, et adresse e-mail partiellement
              masquée
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
          <p className="font-medium text-foreground">
            Bases légales (article 6 du RGPD)
          </p>
          <Table
            head={["Traitement", "Base légale"]}
            rows={[
              [
                "Gestion de votre compte et de vos réservations, communications liées à vos courses",
                "Exécution du contrat",
              ],
              ["Paiement de la prestation", "Exécution du contrat"],
              [
                "Facturation, avoirs et conservation des pièces comptables",
                "Obligation légale",
              ],
              ["Mesure publicitaire Google Ads (cookies)", "Consentement"],
              [
                "Sécurité de la plateforme, prévention de la fraude, journaux techniques, preuve de l'acceptation des CGV et de la politique de confidentialité",
                "Intérêt légitime",
              ],
              [
                "Examen d'une candidature de chauffeur partenaire",
                "Mesures précontractuelles prises à votre demande",
              ],
              ["Réponse aux messages du formulaire de contact", "Intérêt légitime"],
            ]}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Durée de conservation</h2>
          <Placeholder />
          <Table
            head={["Données", "Durée"]}
            rows={[
              [
                "Compte client et données de réservation",
                "Pendant la relation commerciale, puis 3 ans après votre dernier contact avec nous",
              ],
              [
                "Factures et avoirs",
                "10 ans (article L123-22 du Code de commerce)",
              ],
              [
                "Preuve d'acceptation des CGV et de la politique de confidentialité (date et version)",
                "Pendant la relation commerciale, puis 5 ans (délai de prescription de droit commun, article 2224 du Code civil)",
              ],
              [
                "Votre choix concernant les cookies Google Ads",
                "6 mois, enregistré uniquement sur votre appareil (aucune copie n'est conservée sur nos serveurs)",
              ],
              [
                "Journaux techniques",
                <>
                  Écrits sur la sortie des services de notre serveur
                  d&apos;application, sans base de journaux dédiée ; leur durée de
                  conservation dépend de la configuration de l&apos;hébergement :{" "}
                  <ToComplete>durée à compléter</ToComplete>
                </>,
              ],
              [
                "Sauvegardes de la base de données",
                "Sauvegarde quotidienne, chaque sauvegarde étant supprimée automatiquement au bout de 8 à 9 jours",
              ],
              [
                "Candidature de chauffeur partenaire et justificatifs",
                <ToComplete key="partenaires">durée à compléter</ToComplete>,
              ],
              [
                "Photos d'état des lieux",
                <ToComplete key="photos">durée à compléter</ToComplete>,
              ],
              [
                "Messages du formulaire de contact (transmis par e-mail, non enregistrés dans notre base de données)",
                <ToComplete key="contact">durée à compléter</ToComplete>,
              ],
            ]}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Destinataires, sous-traitants et transferts hors de l&apos;Union européenne</h2>
          <p className="text-muted-foreground leading-relaxed">
            Vos données sont accessibles aux seules personnes habilitées de
            TRANSPORT24H.FR. Le chauffeur affecté à votre course par TRANSPORT24H.FR
            reçoit les informations nécessaires à la prestation : adresses de départ et
            d&apos;arrivée, date et heure, volume, nombre de manutentionnaires et votre
            numéro de téléphone.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Nous faisons appel aux prestataires suivants, qui traitent des données pour
            notre compte :
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Hetzner Online GmbH</span>{" "}
              (Allemagne) — hébergement du site, du serveur d&apos;application et de la
              base de données. Localisation des serveurs :{" "}
              <ToComplete>localisation à confirmer</ToComplete>
            </li>
            <li>
              <span className="font-medium text-foreground">
                Stripe Payments Europe Ltd
              </span>{" "}
              (Irlande) — paiement par carte bancaire. Stripe reçoit vos nom et adresse
              e-mail, le montant de la prestation, les données de carte saisies dans
              ses champs de paiement et les identifiants techniques de votre compte et
              de votre réservation.
            </li>
            <li>
              <span className="font-medium text-foreground">Cloudflare</span> (service de
              stockage R2) — stockage des justificatifs des candidatures de chauffeurs
              partenaires et des photos d&apos;état des lieux.{" "}
              <ToComplete>entité contractante et localisation du stockage à confirmer</ToComplete>
            </li>
            <li>
              <span className="font-medium text-foreground">
                Prestataire d&apos;envoi d&apos;e-mails
              </span>{" "}
              <ToComplete>nom à compléter</ToComplete> — envoi des e-mails liés à votre
              compte et à vos courses, et transmission des messages du formulaire de
              contact.
            </li>
            <li>
              <span className="font-medium text-foreground">Google Ireland Limited</span>{" "}
              (Irlande) — mesure des conversions Google Ads, uniquement si vous y avez
              consenti (voir « Cookies et traceurs »).
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Transferts hors de l&apos;Union européenne : Stripe et Google peuvent
            transférer des données à leurs sociétés liées aux États-Unis (Stripe, Inc. et
            Google LLC). Ces transferts sont encadrés par le cadre de protection des
            données UE–États-Unis (Data Privacy Framework) et/ou par les clauses
            contractuelles types adoptées par la Commission européenne.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Les tuiles de carte et la recherche d&apos;adresses sont fournies par des
            services d&apos;OpenStreetMap que votre navigateur contacte directement. Ce
            sont des services tiers et non nos sous-traitants : ils reçoivent votre
            adresse IP (et, pour la recherche, le texte de l&apos;adresse saisie) et les
            traitent selon leurs propres conditions (voir « Cookies et traceurs »).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Vos droits</h2>
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
            <li>
              Droit de retirer à tout moment votre consentement, lorsque le traitement
              repose sur celui-ci (art. 7), sans remettre en cause le traitement effectué
              avant le retrait
            </li>
            <li>
              Droit de définir des directives relatives au sort de vos données après
              votre décès (art. 85 de la loi n° 78-17 du 6 janvier 1978)
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Pour exercer ces droits, contactez-nous à{" "}
            <a
              href="mailto:contact@transport24h.fr"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              contact@transport24h.fr
            </a>
            . Nous répondons dans un délai d&apos;un mois à compter de la réception de
            votre demande ; ce délai peut être prolongé de deux mois compte tenu de la
            complexité ou du nombre de demandes, auquel cas vous en êtes informé dans le
            premier mois (art. 12 du RGPD). Pour retirer votre consentement aux cookies
            Google Ads, utilisez le lien « Gérer mes cookies » (voir « Cookies et
            traceurs »).
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Vous pouvez également introduire une réclamation auprès de la Commission
            nationale de l&apos;informatique et des libertés (CNIL), 3 place de Fontenoy,
            TSA 80715, 75334 Paris Cedex 07 —{" "}
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              www.cnil.fr
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le site transport24h.fr utilise des cookies strictement nécessaires, qui ne
            requièrent pas de consentement préalable (liste ci-dessous), ainsi que, uniquement
            avec votre accord, des cookies de mesure publicitaire Google Ads (voir la section
            « Cookies et traceurs » ci-dessous). Il n&apos;utilise aucun cookie de mesure
            d&apos;audience.
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
              {" "}— identification du type de compte (client, entreprise, chauffeur,
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

        {/* À FAIRE VALIDER PAR AHMED — section factuelle, non validée juridiquement */}
        <section id="cookies" className="scroll-mt-24 space-y-3">
          <h2 className="text-lg font-semibold">Cookies et traceurs</h2>
          <Placeholder />
          <p className="font-medium text-foreground">
            Mesure publicitaire : Google Ads
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              Finalité : mesure des conversions publicitaires, c&apos;est-à-dire savoir si
              une réservation confirmée fait suite à une annonce Google Ads.
            </li>
            <li>
              Consentement : le script de Google Ads n&apos;est chargé et ses cookies ne
              sont déposés qu&apos;après avoir cliqué sur « Tout accepter » (ou activé la
              mesure publicitaire dans « Personnaliser »). En cas de refus, aucun script
              Google n&apos;est chargé.
            </li>
            <li>
              Durée : votre choix, qu&apos;il s&apos;agisse d&apos;une acceptation ou d&apos;un
              refus, est conservé 6 mois sur votre appareil. À l&apos;issue de ce délai,
              il vous est demandé à nouveau.
            </li>
            <li>
              Retirer ou modifier votre choix : à tout moment, via le lien « Gérer mes
              cookies » en pied de page (par exemple sur la page d&apos;accueil ou sur
              cette page). Le retrait prend effet immédiatement :
              plus aucune donnée n&apos;est envoyée à Google Ads.
            </li>
          </ul>
          <p className="font-medium text-foreground">
            Services tiers contactés par votre navigateur
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Pour fournir certaines fonctionnalités, votre navigateur se connecte
            directement aux services suivants, qui reçoivent à cette occasion votre
            adresse IP :
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Stripe</span> — paiement
              en ligne (js.stripe.com, api.stripe.com), sur la page de paiement.
            </li>
            <li>
              <span className="font-medium text-foreground">OpenStreetMap</span> —
              affichage des tuiles de la carte du devis (tile.openstreetmap.org).
            </li>
            <li>
              <span className="font-medium text-foreground">
                Nominatim (OpenStreetMap)
              </span>{" "}
              — recherche et autocomplétion des adresses saisies
              (nominatim.openstreetmap.org), qui reçoit le texte de l&apos;adresse tapée.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Sécurité</h2>
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

// Information manquante, à fournir par l'éditeur : affichée visiblement, jamais inventée
function ToComplete({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
      [{children}]
    </span>
  )
}

function Table({
  head,
  rows,
}: {
  head: [string, string]
  rows: Array<[string, React.ReactNode]>
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/30 text-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {rows.map(([label, value]) => (
            <tr key={label} className="border-t border-border/50 align-top">
              <td className="px-4 py-2">{label}</td>
              <td className="px-4 py-2">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
