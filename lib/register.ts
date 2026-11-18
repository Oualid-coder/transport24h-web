// Logique pure des formulaires où la personne crée elle-même son compte ou sa candidature :
// inscription (POST /auth/register), activation d'un compte entreprise (POST /auth/accept-invitation),
// candidature partenaire (POST /partners). Corps envoyés et traduction des erreurs (testés avec node --test).
import * as z from "@/lib/zod"
import type { AcceptInvitationBody, PartnerApplyBody, RegisterBody, TruckType } from "@/lib/types"
import { TERMS_REQUIRED_MESSAGE, termsAcceptanceFields } from "@/lib/legal"
import { ApiError } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"

// Case obligatoire « 18 ans + CGV + politique de confidentialité », identique sur tous les formulaires
export const acceptTermsField = z.literal(true, { error: TERMS_REQUIRED_MESSAGE })

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
  return { ...body, ...termsAcceptanceFields(form.acceptTerms) }
}

export function buildAcceptInvitationBody(
  token: string,
  password: string,
  acceptTerms: boolean,
): AcceptInvitationBody {
  return { token, password, ...termsAcceptanceFields(acceptTerms) }
}

export interface PartnerFormValues {
  firstName: string
  lastName: string
  email: string
  phone: string
  siret: string
  truckType: TruckType
  acceptTerms: boolean
}

export function buildPartnerApplyBody(form: PartnerFormValues): PartnerApplyBody {
  return {
    first_name: form.firstName,
    last_name: form.lastName,
    email: form.email,
    phone: form.phone,
    siret: form.siret,
    truck_type: form.truckType,
    ...termsAcceptanceFields(form.acceptTerms),
  }
}

// L'API renvoie en 422 le message brut du validateur Go
// (ex. "Key: 'registerRequest.Phone' Error:Field validation for 'Phone' failed on the 'phone_fr' tag").
// On le traduit en message lisible, sans jamais afficher le texte technique.
export function registerErrorMessage(status: number, apiMessage: string): string {
  if (status === 409) return "Un compte existe déjà avec cet e-mail."
  if (status === 422) {
    if (isTermsRequiredError(status, apiMessage)) return TERMS_REQUIRED_MESSAGE
    // Le champ apparaît sous la forme 'registerRequest.Phone' et/ou 'Phone'
    const has = (field: string) => new RegExp(`[.']${field}'`).test(apiMessage)
    if (has("Phone"))
      return "Numéro de téléphone invalide — ex : 0612345678 ou +33612345678."
    if (has("Email")) return "Adresse e-mail invalide."
    if (has("Password"))
      return "Mot de passe invalide — 8 caractères minimum."
    if (has("FirstName") || has("LastName"))
      return "Le prénom et le nom sont obligatoires."
    // Bornes de longueur de l'API (message en français, sans nom de champ Go)
    if (/ne doit pas dépasser/.test(apiMessage)) {
      if (/mot de passe/.test(apiMessage))
        return "Mot de passe trop long — 72 caractères maximum (sans accents)."
      if (/\bemail\b/.test(apiMessage)) return "Adresse e-mail trop longue (254 caractères maximum)."
      if (/first_name|last_name/.test(apiMessage))
        return "Le prénom et le nom ne doivent pas dépasser 100 caractères."
    }
    if (has("TermsVersion"))
      return "Impossible d'enregistrer votre acceptation des conditions. Réessayez plus tard ou contactez-nous."
    return "Certaines informations sont invalides. Vérifiez le formulaire."
  }
  return apiMessage || "Une erreur est survenue. Veuillez réessayer."
}

// Minuscules sans accents, pour comparer les messages de l'API
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

// 422 de l'API quand la case des conditions manque (inscription, activation, candidature) :
// « Vous devez accepter les CGV et la politique de confidentialité. »
export function isTermsRequiredError(status: number, apiMessage: string): boolean {
  return status === 422 && normalize(apiMessage).includes("accepter les cgv")
}

export const INVITATION_LINK_INVALID_MESSAGE =
  "Ce lien d'invitation est invalide ou a déjà été utilisé. Si votre compte n'est pas encore activé, demandez un nouveau lien à votre interlocuteur Transport24h."
export const INVITATION_LINK_EXPIRED_MESSAGE =
  "Ce lien d'invitation a expiré. Demandez un nouveau lien à votre interlocuteur Transport24h."
const ACCEPT_INVITATION_FALLBACK = "Une erreur est survenue. Veuillez réessayer."

// Erreurs de POST /auth/accept-invitation (handler AcceptInvitation de l'API) :
// 410 lien expiré ; 422 « lien d'invitation invalide ou déjà utilisé », mot de passe (< 8 caractères,
// > 72 octets), CGV, « token et password obligatoires » ou texte du validateur Go ; 400 JSON ; 500.
export function acceptInvitationErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const msg = normalize(err.message)
    if (err.status === 410) return INVITATION_LINK_EXPIRED_MESSAGE
    // Non renvoyé par le handler actuel : conservé de l'ancien écran
    if (err.status === 409) return "Ce compte a déjà été activé."
    if (err.status === 422) {
      if (isTermsRequiredError(err.status, err.message)) return TERMS_REQUIRED_MESSAGE
      if (msg.includes("lien d'invitation")) return INVITATION_LINK_INVALID_MESSAGE
      if (msg.includes("mot de passe")) {
        if (msg.includes("ne doit pas depasser"))
          return "Mot de passe trop long — 72 caractères maximum (sans accents)."
        return "Mot de passe invalide."
      }
      return ACCEPT_INVITATION_FALLBACK
    }
  }
  // 429 / 503 : messages communs ; 400, 5xx, réseau : repli
  return errorMessage(err, ACCEPT_INVITATION_FALLBACK)
}

// URL de connexion après inscription : `verify=sent` seulement si l'API répond email_verified === false
// (un mail de vérification a été envoyé). `redirect` conservé pour reprendre le parcours.
export function registeredLoginUrl(redirect: string | null, emailVerified: boolean | undefined): string {
  const qs = new URLSearchParams({ registered: "1" })
  if (emailVerified === false) qs.set("verify", "sent")
  if (redirect) qs.set("redirect", redirect)
  return `/login?${qs.toString()}`
}
