import Link from "next/link"
import { Clock } from "lucide-react"
import { BackButton } from "@/components/BackButton"
import { TERMS_VERSION, formatTermsDate } from "@/lib/legal"

export default function CGVPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <BackButton href="/" />
      </div>

      <h1 className="text-3xl font-bold">Conditions générales de vente</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : {formatTermsDate(TERMS_VERSION)}
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
          <p className="font-medium text-foreground">Comptes entreprises</p>
          <p className="text-muted-foreground leading-relaxed">
            Les réservations effectuées au moyen d&apos;un compte entreprise, ouvert sur
            invitation de TRANSPORT24H.FR, relèvent en outre de conditions particulières
            convenues entre TRANSPORT24H.FR et l&apos;entreprise concernée, notamment en
            matière de tarifs, de facturation, d&apos;annulation et de remboursement. Ces
            réservations ne sont pas payées en ligne : TRANSPORT24H.FR établit une facture
            à l&apos;entreprise selon ces conditions particulières. Les règles de paiement en
            ligne (Articles&nbsp;4 et&nbsp;5) et de remboursement (Article&nbsp;6) des
            présentes CGV ne leur sont pas applicables. En cas de contradiction, les
            conditions particulières prévalent sur les présentes CGV.
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
          <p className="text-muted-foreground leading-relaxed">
            La réservation s&apos;effectue en ligne sur le site transport24h.fr, en
            plusieurs étapes :
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-muted-foreground leading-relaxed">
            <li>
              Le Client renseigne les adresses de départ et d&apos;arrivée, la date et
              l&apos;heure souhaitées, le type de véhicule et les prestations
              complémentaires (manutention). Un prix est calculé instantanément.
            </li>
            <li>
              Le Client renseigne ses coordonnées et enregistre un moyen de paiement
              pour valider sa demande.
            </li>
            <li>
              Si la demande ne nécessite pas de traitement particulier, elle est
              confirmée automatiquement et le Client reçoit une confirmation par
              e-mail avec la référence de sa réservation.
            </li>
            <li>
              Si la demande nécessite un ajustement (précisions complémentaires
              fournies par le Client, cas particulier), elle est soumise à validation
              par Transport24h.fr avant confirmation définitive. Le Client est informé
              du délai de traitement, qui n&apos;excède pas{" "}
              <span className="font-medium text-foreground">2 heures ouvrées</span>{" "}
              dans la majorité des cas.
            </li>
          </ol>
          <p className="text-muted-foreground leading-relaxed">
            Si, à l&apos;issue de cet examen, Transport24h.fr ne peut pas réaliser
            la prestation, la réservation est annulée et le Client est intégralement
            remboursé.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Le paiement est effectué dans les conditions décrites à l&apos;Article&nbsp;5.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Un chauffeur est ensuite affecté à la prestation. Le Client est informé
            de cette affectation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Paiement</h2>
          <p className="text-muted-foreground leading-relaxed">
            Le paiement s&apos;effectue exclusivement par carte bancaire via la plateforme
            sécurisée Stripe. Le montant TTC de la prestation est prélevé immédiatement
            lors de la validation du paiement par le Client, y compris lorsque la
            réservation comporte des précisions complémentaires nécessitant un examen
            préalable par Transport24h.fr (Article&nbsp;4, alinéa&nbsp;4).
          </p>
          <p className="text-muted-foreground leading-relaxed">
            TRANSPORT24H.FR ne stocke aucune donnée bancaire — celles-ci sont gérées
            intégralement par Stripe (certifié PCI DSS).
          </p>
          <p className="font-medium text-foreground">Modification d&apos;une réservation payée</p>
          <p className="text-muted-foreground leading-relaxed">
            Toute modification d&apos;une réservation déjà payée entraînant un changement de
            prix intervient uniquement à la demande du Client. En cas de hausse du prix, la
            différence TTC est prélevée sur le moyen de paiement enregistré lors de la
            réservation, après accord du Client sur le nouveau prix. En cas de baisse du
            prix, la différence TTC est remboursée au Client sur le moyen de paiement
            utilisé, et un avoir est émis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Annulation et remboursement</h2>
          <p className="text-muted-foreground leading-relaxed">
            Toute annulation de la prestation par le Client doit être notifiée
            par écrit à{" "}
            <a
              href="mailto:contact@transport24h.fr"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              contact@transport24h.fr
            </a>{" "}
            ou via l&apos;espace client dédié sur transport24h.fr.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            En cas d&apos;annulation par le Client :
          </p>
          <ul className="space-y-2 text-muted-foreground leading-relaxed">
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
              <span>
                <span className="font-medium text-foreground">
                  Plus de 24 heures
                </span>{" "}
                avant la date et l&apos;heure prévues de la prestation :
                remboursement intégral (TTC) du montant versé.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
              <span>
                <span className="font-medium text-foreground">
                  Plus de 2 heures et jusqu&apos;à 24 heures
                </span>{" "}
                avant la date et l&apos;heure prévues : remboursement à hauteur
                de 50&nbsp;% du montant versé (TTC), le solde restant acquis à
                Transport24h.fr au titre de la réservation du créneau et de
                l&apos;immobilisation des moyens matériels et humains.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
              <span>
                <span className="font-medium text-foreground">
                  2 heures ou moins
                </span>{" "}
                avant la date et l&apos;heure prévues : aucun remboursement,
                sauf cas de force majeure dûment justifié.
              </span>
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            En cas d&apos;annulation par Transport24h.fr, le Client sera
            intégralement remboursé et pourra prétendre, le cas échéant, à une
            indemnisation conformément aux dispositions légales applicables.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Pour les comptes entreprises, l&apos;annulation et le remboursement sont régis
            par les conditions particulières mentionnées à l&apos;Article&nbsp;1.
          </p>
        </section>

        <section id="retractation" className="scroll-mt-24 space-y-3">
          <h2 className="text-lg font-semibold">7. Droit de rétractation</h2>
          <p className="text-muted-foreground leading-relaxed">
            Conformément à l&apos;article L221-28, 12° du Code de la consommation, le
            droit de rétractation ne peut être exercé pour les contrats «&nbsp;de
            prestations de services d&apos;hébergement, autres que d&apos;hébergement
            résidentiel, de services de transport de biens, de locations de voitures, de
            restauration ou d&apos;activités de loisirs qui doivent être fournis à une
            date ou à une période déterminée&nbsp;».
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Les prestations proposées sur transport24h.fr sont des services de transport
            de biens exécutés à la date et à l&apos;heure choisies par le Client lors de
            la réservation (Article&nbsp;4). Le Client ne dispose donc pas du droit de
            rétractation de quatorze jours prévu pour les contrats conclus à distance.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Le Client peut toutefois annuler sa réservation dans les conditions et
            selon le barème de remboursement prévus à
            l&apos;Article&nbsp;6 (Annulation et remboursement).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Responsabilités</h2>
          <Placeholder />
          <p className="text-muted-foreground leading-relaxed">
            [À compléter — responsabilités respectives du prestataire et du Client,
            assurance transport, cas de force majeure]
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">9. Données personnelles</h2>
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
          <h2 className="text-lg font-semibold">10. Droit applicable et litiges</h2>
          <p className="text-muted-foreground leading-relaxed">
            Les présentes CGV sont soumises au droit français. En cas de litige, et après
            tentative de résolution amiable, les tribunaux français seront seuls compétents.
          </p>
          <p className="font-medium text-foreground">Médiation de la consommation</p>
          <p className="text-muted-foreground leading-relaxed">
            Conformément aux articles L612-1 et suivants du Code de la consommation, le
            Client consommateur a le droit de recourir gratuitement à un médiateur de la
            consommation en vue de la résolution amiable d&apos;un litige qui l&apos;oppose
            à TRANSPORT24H.FR.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Avant de saisir le médiateur, le Client doit avoir tenté de résoudre le litige
            directement auprès de TRANSPORT24H.FR par une réclamation écrite adressée à{" "}
            <a
              href="mailto:contact@transport24h.fr"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              contact@transport24h.fr
            </a>
            , restée sans réponse satisfaisante. La demande de médiation doit être
            introduite dans un délai d&apos;un an à compter de cette réclamation écrite.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Médiateur compétent :{" "}
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
              [coordonnées du médiateur à compléter]
            </span>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">11. Contact</h2>
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
