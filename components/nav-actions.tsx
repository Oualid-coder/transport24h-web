"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { logout } from "@/lib/api"

interface NavActionsProps {
  isLoggedIn: boolean
}

export function NavActions({ isLoggedIn }: NavActionsProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  if (isLoggedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Mon espace
        </Link>
        <button
          onClick={handleLogout}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <LogOut className="mr-1.5 size-3.5" />
          Déconnexion
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Connexion
      </Link>
      <a href="/#devis" className={buttonVariants({ size: "sm" })}>
        Obtenir un devis
      </a>
    </div>
  )
}
