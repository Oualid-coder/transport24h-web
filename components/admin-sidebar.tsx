"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Truck,
  Users,
  X,
} from "lucide-react"
import { logout } from "@/lib/api"

const NAV_ITEMS = [
  { href: "/admin/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/pricing",    icon: Settings,        label: "Tarification" },
  { href: "/admin/partners",   icon: Users,           label: "Partenaires" },
  { href: "/admin/drivers",    icon: Truck,           label: "Chauffeurs" },
  { href: "/admin/companies",  icon: Building2,       label: "Entreprises" },
  { href: "/admin/credit-notes", icon: Receipt,       label: "Avoirs à émettre" },
]

export function AdminSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  // Menu mobile (< lg) : la barre latérale devient un tiroir ouvert par le bouton de la barre du haut.
  const [open, setOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const router = useRouter()
  // Tiroir ouvert : toujours en grand (le mode réduit ne concerne que l'ordinateur).
  const compact = collapsed && !open

  useEffect(() => {
    if (!open) return
    // Focus sur le premier lien ; Échap ferme et rend le focus au bouton ; passage en ≥ lg ferme.
    navRef.current?.querySelector("a")?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setOpen(false)
      menuButtonRef.current?.focus()
    }
    const desktop = window.matchMedia("(min-width: 64rem)")
    const onDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    // La page derrière le tiroir ne défile pas tant qu'il est ouvert.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKey)
    desktop.addEventListener("change", onDesktop)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKey)
      desktop.removeEventListener("change", onDesktop)
    }
  }, [open])

  const closeMenu = () => {
    setOpen(false)
    menuButtonRef.current?.focus()
  }

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <>
      {/* Barre du haut (mobile) : bouton du menu */}
      <header className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b border-border/50 bg-card px-2 lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
          <span className="sr-only">{open ? "Fermer le menu" : "Ouvrir le menu"}</span>
        </button>
        <Image
          src="/logo-transport24h.png"
          alt="Transport24h"
          width={84}
          height={28}
          className="h-7 w-auto shrink-0 object-contain"
        />
        <span className="text-sm font-semibold">Transport24h</span>
        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          Admin
        </span>
      </header>

      {/* Fond du tiroir (mobile) : un toucher ferme le menu */}
      {open && (
        <div
          aria-hidden="true"
          className="fixed inset-x-0 top-14 bottom-0 z-40 bg-black/30 lg:hidden"
          onClick={closeMenu}
        />
      )}

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex-col border-r border-border/50 bg-card transition-all duration-200 max-lg:top-14 lg:flex ${
          open ? "flex" : "hidden"
        } ${compact ? "w-16" : "w-60"}`}
      >
        {/* Logo (ordinateur ; sur mobile il est dans la barre du haut) */}
        <div
          className={`hidden h-16 shrink-0 items-center border-b border-border/50 lg:flex ${
            compact ? "justify-center px-3" : "gap-2.5 px-5"
          }`}
        >
          <Image
            src="/logo-transport24h.png"
            alt="Transport24h"
            width={84}
            height={28}
            className="h-7 w-auto shrink-0 object-contain"
          />
          {!compact && (
            <>
              <span className="text-sm font-semibold">Transport24h</span>
              <span className="ml-auto rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Admin
              </span>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav ref={navRef} aria-label="Administration" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              title={compact ? label : undefined}
              onClick={closeMenu}
              className={`flex items-center rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-lg:min-h-11 ${
                compact ? "justify-center" : "gap-2.5"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {!compact && label}
            </Link>
          ))}
        </nav>

        {/* Footer : déconnexion + toggle */}
        <div className="border-t border-border/50 p-3 space-y-1">
          <button
            onClick={handleLogout}
            title={compact ? "Déconnexion" : undefined}
            className={`flex w-full items-center rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-lg:min-h-11 ${
              compact ? "justify-center" : "gap-2.5"
            }`}
          >
            <LogOut className="size-4 shrink-0" />
            {!compact && "Déconnexion"}
          </button>

          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Développer" : "Réduire"}
            className={`hidden w-full items-center rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex ${
              compact ? "justify-center" : "gap-2.5"
            }`}
          >
            {compact ? (
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

      {/* Contenu principal — suit la largeur de la sidebar (ordinateur) ; inerte sous le tiroir mobile */}
      <div
        inert={open}
        className={`flex min-w-0 flex-1 flex-col transition-all duration-200 ${
          compact ? "lg:ml-16" : "lg:ml-60"
        }`}
      >
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </>
  )
}
