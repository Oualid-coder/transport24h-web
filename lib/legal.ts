// Version des textes légaux (CGV + politique de confidentialité).
// Source unique : envoyée à l'API à l'inscription (terms_version) ET affichée comme
// « dernière mise à jour » sur les deux pages. À changer à chaque modification des textes.
// Format imposé par l'API : ^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$
export const TERMS_VERSION = "2026-11-17"

// "2026-11-17" → "17 novembre 2026" (UTC : même rendu quel que soit le fuseau du serveur)
export function formatTermsDate(version: string = TERMS_VERSION): string {
  return new Date(`${version}T00:00:00Z`).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}
