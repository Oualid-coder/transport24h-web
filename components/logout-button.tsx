"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { logout } from "@/lib/api"

interface LogoutButtonProps {
  className?: string
  // Libellé masqué visuellement sur petit écran (reste lu par les lecteurs d'écran)
  labelClassName?: string
}

export function LogoutButton({ className, labelClassName }: LogoutButtonProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <button
      onClick={handleLogout}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <LogOut className="size-4" />
      <span className={labelClassName}>Déconnexion</span>
    </button>
  )
}
