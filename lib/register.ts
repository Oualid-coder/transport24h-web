// Logique pure de l'inscription : construction du corps envoyé à POST /auth/register
// et traduction des erreurs de l'API. Sans dépendance runtime (testée avec node --test).
import type { RegisterBody } from "@/lib/types"
import { TERMS_VERSION } from "@/lib/legal"

// Même règle que l'API (validateur phone_fr), appliquée au numéro nettoyé
export const PHONE_FR_REGEX = /^(0|\+33)[1-9][0-9]{8}$/

// Retire espaces (y compris insécables), points et tirets : "06 12-34.56 78" → "0612345678"
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s.\-]/g, "")
}

export function isValidPhone(raw: string): boolean {
  return PHONE_FR_REGEX.test(normalizePhone(raw))
}

export interface RegisterFormValues {
  firstName: string
  lastName: string
  email: string
  phone?: string
  password: string
  acceptTerms: boolean
}

export function buildRegisterBody(form: RegisterFormValues): RegisterBody {
  const body: RegisterBody = {
    first_name: form.firstName,
    last_name: form.lastName,
    email: form.email,
    password: form.password,
  }
  const phone = form.phone ? normalizePhone(form.phone) : ""
  if (phone) body.phone = phone
  // La date d'acceptation est posée par le serveur : seule la version est envoyée
  if (form.acceptTerms === true) {
    body.terms_accepted = true
    body.terms_version = TERMS_VERSION
  }
  return body
}

// L'API renvoie en 422 le message brut du validateur Go
// (ex. "Key: 'registerRequest.Phone' Error:Field validation for 'Phone' failed on the 'phone_fr' tag").
// On le traduit en message lisible, sans jamais afficher le texte technique.
export function registerErrorMessage(status: number, apiMessage: string): string {
  if (status === 409) return "Un compte existe déjà avec cet e-mail."
  if (status === 422) {
    // Le champ apparaît sous la forme 'registerRequest.Phone' et/ou 'Phone'
    const has = (field: string) => new RegExp(`[.']${field}'`).test(apiMessage)
    if (has("Phone"))
      return "Numéro de téléphone invalide — ex : 0612345678 ou +33612345678."
    if (has("Email")) return "Adresse e-mail invalide."
    if (has("Password"))
      return "Mot de passe invalide — 8 caractères minimum."
    if (has("FirstName") || has("LastName"))
      return "Le prénom et le nom sont obligatoires."
    if (has("TermsVersion"))
      return "Impossible d'enregistrer votre acceptation des conditions. Réessayez plus tard ou contactez-nous."
    return "Certaines informations sont invalides. Vérifiez le formulaire."
  }
  return apiMessage || "Une erreur est survenue. Veuillez réessayer."
}
