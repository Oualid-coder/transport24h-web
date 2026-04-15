import Link from "next/link"
import { LayoutDashboard, Settings, Truck } from "lucide-react"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border/50 bg-card">
        <div className="flex h-16 items-center gap-2.5 border-b border-border/50 px-5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary">
            <Truck className="size-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold">Transport24h</span>
          <span className="ml-auto rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            Admin
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LayoutDashboard className="size-4" />
            Dashboard
          </Link>
          <Link
            href="/admin/pricing"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings className="size-4" />
            Tarification
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <div className="ml-60 flex flex-1 flex-col">
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
