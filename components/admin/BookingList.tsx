"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from "lucide-react"
import { getAdminBookings } from "@/lib/api"
import { BookingCard } from "./BookingCard"

const LIMIT = 20

export function BookingList({ status }: { status?: string }) {
  const [page, setPage] = useState(1)
  const queryKey = ["admin-bookings", status ?? "all", page]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getAdminBookings(status, page, LIMIT),
    refetchInterval: 30_000,
  })

  const bookings = data?.bookings ?? []
  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0

  const sorted = [...bookings].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-16 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucune réservation.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {sorted.map((b) => (
          <BookingCard key={b.id} booking={b} queryKey={queryKey} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
            {data && (
              <span className="ml-2 text-xs">
                ({data.total} réservation{data.total > 1 ? "s" : ""})
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
