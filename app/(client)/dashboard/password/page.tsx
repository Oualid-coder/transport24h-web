import Link from "next/link"
import { ChangePasswordForm } from "@/components/ChangePasswordForm"

// Espace client et entreprise (b2b) : changement du mot de passe.
export default function ClientPasswordPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/dashboard" className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground max-lg:py-3">
        ← Mon espace
      </Link>
      <ChangePasswordForm />
    </div>
  )
}
