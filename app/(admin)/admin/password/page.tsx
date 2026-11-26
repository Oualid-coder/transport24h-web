import { ChangePasswordForm } from "@/components/ChangePasswordForm"

// Administration : changement du mot de passe du compte admin.
export default function AdminPasswordPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mot de passe</h1>
      <ChangePasswordForm />
    </div>
  )
}
