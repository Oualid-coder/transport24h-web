import { AdminSidebar } from "@/components/admin-sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen max-lg:flex-col">
      <AdminSidebar>{children}</AdminSidebar>
    </div>
  )
}
