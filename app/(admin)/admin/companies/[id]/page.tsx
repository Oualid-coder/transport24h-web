import { BackButton } from "@/components/BackButton"
import { BookingsReport } from "@/components/BookingsReport"
import { CompanyInfo } from "@/components/admin/CompanyInfo"

// Fiche d'une entreprise : informations (GET /admin/companies/{id}) et relevé des courses (vue admin).
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <div className="min-w-0 space-y-8">
      <BackButton href="/admin/companies" />
      <CompanyInfo id={id} />
      <BookingsReport target={{ view: "admin", companyId: id }} title="Relevé des courses" />
    </div>
  )
}
