import type { Metadata } from "next"

// Page ouverte depuis le lien du mail (#token=…) : aucun Referer envoyé depuis cette page, même
// vers le site (le jeton est dans le fragment, que le navigateur n'envoie jamais ; il est en plus
// retiré de l'URL dès la lecture). Pas d'indexation.
export const metadata: Metadata = {
  title: "Nouveau mot de passe — Transport24h",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
