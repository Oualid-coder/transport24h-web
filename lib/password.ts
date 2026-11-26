// Mot de passe : « oublié » (POST /auth/forgot-password), réinitialisation par lien
// (POST /auth/reset-password) et changement dans l'espace connecté (POST /auth/change-password,
// via le Route Handler /api/auth/change-password qui repose les cookies de session).
// Logique pure (schémas zod, corps, messages), testée avec node --test.
import * as z from "@/lib/zod"
import { ApiError } from "@/lib/api"
import { errorMessage } from "@/lib/error-message"

// Bornes de l'API (bcrypt) : 72 octets UTF-8 au plus ; à l'écran, mêmes règles que l'inscription
// (8 caractères minimum, au moins un chiffre).
export const PASSWORD_MAX_BYTES = 72

export function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length
}

export const newPasswordField = z
  .string()
  .min(8, { error: "8 caractères minimum" })
  .regex(/[0-9]/, { message: "Le mot de passe doit contenir au moins un chiffre" })
  .refine((v) => utf8Length(v) <= PASSWORD_MAX_BYTES, {
    message: "Mot de passe trop long — 72 caractères maximum (sans accents)",
  })

export const forgotPasswordSchema = z.object({
  email: z.email({ error: "Adresse e-mail invalide" }).max(254, { error: "Adresse e-mail trop longue" }),
})

export const resetPasswordSchema = z
  .object({ password: newPasswordField, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Mot de passe actuel requis" }),
    newPassword: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "Le nouveau mot de passe doit être différent de l'actuel",
    path: ["newPassword"],
  })

// Réponse affichée après une demande, que le compte existe ou non (l'API répond pareil).
export const FORGOT_SENT_MESSAGE =
  "Si un compte existe pour cette adresse, un email contenant un lien de réinitialisation vient de lui être envoyé. Le lien est valable 1 heure."

export const RESET_LINK_INVALID_MESSAGE =
  "Ce lien de réinitialisation est invalide, a expiré ou a déjà été utilisé. Demandez un nouveau lien."

// Minuscules sans accents, pour comparer les messages de l'API
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

// 422 de l'API « lien de réinitialisation invalide, expiré ou déjà utilisé » (jeton forgé,
// expiré, réutilisé, remplacé par une demande plus récente, compte désactivé).
export function isResetLinkInvalid(err: unknown): boolean {
  return err instanceof ApiError && err.status === 422 && normalize(err.message).includes("lien de reinitialisation")
}

export function forgotErrorMessage(err: unknown): string {
  return errorMessage(err, "La demande n'a pas pu aboutir. Réessayez dans quelques minutes.")
}

export function resetErrorMessage(err: unknown): string {
  if (isResetLinkInvalid(err)) return RESET_LINK_INVALID_MESSAGE
  return errorMessage(err, "La réinitialisation n'a pas pu aboutir. Réessayez dans quelques minutes.")
}

// 403 « mot de passe actuel incorrect », 409 changement concurrent, 422 règles, 429 limite :
// messages de l'API (errorMessage). 401 : session expirée, redirection gérée par lib/api.ts.
export function changeErrorMessage(err: unknown): string {
  return errorMessage(err, "Le changement de mot de passe n'a pas pu aboutir. Réessayez dans quelques minutes.")
}

// Connexion après un changement sans nouvelle session (bannière de /login).
export const RELOGIN_AFTER_CHANGE_URL = "/login?password=changed"
export const PASSWORD_CHANGED_LOGIN_MESSAGE =
  "Votre mot de passe a été modifié et vos sessions ont été fermées : connectez-vous avec votre nouveau mot de passe."

export interface ChangePasswordBody {
  current_password: string
  new_password: string
}

export function buildChangePasswordBody(current: string, next: string): ChangePasswordBody {
  return { current_password: current, new_password: next }
}

export interface ResetPasswordBody {
  token: string
  password: string
}

export function buildResetPasswordBody(token: string, password: string): ResetPasswordBody {
  return { token, password }
}
