import type { PartnerApplication, PartnerStatus } from "@/lib/types"

// Onglets de /admin/partners : la liste est demandée filtrée à l'API (GET /admin/partners?status=,
// filtre appliqué côté API depuis le sujet 49) et refiltrée ici. L'onglet n'affiche ainsi que
// son statut même face à une API qui ignore le paramètre (image antérieure pendant un
// déploiement) et dès qu'une carte change de statut (approbation, refus) avant la relecture.
export function partnersForStatus(
  partners: readonly PartnerApplication[],
  status?: PartnerStatus,
): PartnerApplication[] {
  return status ? partners.filter((p) => p.status === status) : [...partners]
}
