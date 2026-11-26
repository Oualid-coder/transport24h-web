// Version des textes légaux (CGV + politique de confidentialité).
// Source unique : envoyée à l'API à l'inscription, à l'activation d'un compte entreprise et à la
// candidature partenaire (terms_version), ET affichée comme « dernière mise à jour » sur les deux
// pages. À changer à chaque modification des textes.
// Format imposé par l'API : ^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$
// AAAA-MM-JJ, suivi de ".N" pour une nouvelle version publiée le même jour
// ("2026-11-17", "2026-11-17.2", "2026-11-19", "2026-11-20" et "2026-11-26" ont déjà été déployées avec les textes précédents).
export const TERMS_VERSION = "2026-11-26.2"

// Message unique de la case « 18 ans + CGV + politique de confidentialité » (tous les formulaires)
export const TERMS_REQUIRED_MESSAGE =
  "Vous devez certifier avoir 18 ans ou plus et accepter les CGV et la politique de confidentialité"

export interface TermsAcceptanceFields {
  terms_accepted?: boolean
  terms_version?: string
}

// Champs envoyés à l'API quand la case est cochée. Jamais de date : elle est posée par le serveur.
export function termsAcceptanceFields(accepted: boolean): TermsAcceptanceFields {
  return accepted === true ? { terms_accepted: true, terms_version: TERMS_VERSION } : {}
}

// "2026-11-17" ou "2026-11-17.2" → "17 novembre 2026" : seuls les 10 premiers caractères
// (AAAA-MM-JJ) font la date (UTC : même rendu quel que soit le fuseau du serveur)
export function formatTermsDate(version: string = TERMS_VERSION): string {
  return new Date(`${version.slice(0, 10)}T00:00:00Z`).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}
