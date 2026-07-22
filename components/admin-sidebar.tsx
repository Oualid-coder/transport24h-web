"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react"
import { logout } from "@/lib/api"

const NAV_ITEMS = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/pricing",   icon: Settings,        label: "Tarification" },
  { href: "/admin/partners",  icon: Users,           label: "Partenaires" },
]

export function AdminSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/50 bg-card transition-all duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Logo */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-border/50 ${
            collapsed ? "justify-center px-3" : "gap-2.5 px-5"
          }`}
        >
          <Image
            src="/logo-transport24h.png"
            alt="Transport24h"
            width={84}
            height={28}
            className="h-7 w-auto shrink-0 object-contain"
          />
          {!collapsed && (
            <>
              <span className="text-sm font-semibold">Transport24h</span>
              <span className="ml-auto rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Admin
              </span>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
                collapsed ? "justify-center" : "gap-2.5"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && label}
            </Link>
          ))}
        </nav>

        {/* Footer : déconnexion + toggle */}
        <div className="border-t border-border/50 p-3 space-y-1">
          <button
            onClick={handleLogout}
            title={collapsed ? "Déconnexion" : undefined}
            className={`flex w-full items-center rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
              collapsed ? "justify-center" : "gap-2.5"
            }`}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && "Déconnexion"}
          </button>

          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Développer" : "Réduire"}
            className={`flex w-full items-center rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
              collapsed ? "justify-center" : "gap-2.5"
            }`}
          >
            {collapsed ? (
              <ChevronRight className="size-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="size-4 shrink-0" />
                Réduire
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Contenu principal — suit la largeur de la sidebar */}
      <div
        className={`flex flex-1 flex-col transition-all duration-200 ${
          collapsed ? "ml-16" : "ml-60"
        }`}
      >
        <main className="flex-1 p-8">{children}</main>
      </div>
    </>
  )
}
