"use client"

import { useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Camera, ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  uploadBookingPhoto,
  getDriverBookingPhotos,
  getAdminBookingPhotos,
  ApiError,
} from "@/lib/api"

const MAX_PHOTO_SIZE = 8 * 1024 * 1024

function PhotoGrid({ urls }: { urls: string[] }) {
  if (urls.length === 0) {
    return <p className="text-xs italic text-muted-foreground">Aucune photo.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={url}
            alt=""
            className="h-16 w-16 rounded-md border border-border/50 object-cover transition-opacity hover:opacity-80"
          />
        </a>
      ))}
    </div>
  )
}

function PhaseRow({
  label,
  bookingId,
  phase,
  photos,
  canUpload,
  uploadDisabled,
  queryKey,
}: {
  label: string
  bookingId: string
  phase: "before" | "after"
  photos: string[]
  canUpload: boolean
  uploadDisabled: boolean
  queryKey: unknown[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (file: File) => uploadBookingPhoto(bookingId, phase, file),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'envoi.")
    },
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_PHOTO_SIZE) {
      setError("Fichier trop volumineux — 8 Mo maximum.")
      if (inputRef.current) inputRef.current.value = ""
      return
    }
    setError(null)
    mutation.mutate(file)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleChange}
              disabled={mutation.isPending || uploadDisabled}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              disabled={mutation.isPending || uploadDisabled}
              onClick={() => inputRef.current?.click()}
            >
              {mutation.isPending ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <Plus className="mr-1 size-3" />
              )}
              Ajouter
            </Button>
          </>
        )}
      </div>
      <PhotoGrid urls={photos} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

interface BookingPhotoSectionProps {
  bookingId: string
  variant: "driver" | "admin"
  canUploadAfter?: boolean
}

export function BookingPhotoSection({
  bookingId,
  variant,
  canUploadAfter = true,
}: BookingPhotoSectionProps) {
  const [open, setOpen] = useState(false)
  const canUpload = variant === "driver"
  const queryKey = [`${variant}-photos`, bookingId]
  // URLs signées 1h (driver) ou 15 min (admin) — staleTime conservateur en dessous
  const staleTime = variant === "admin" ? 10 * 60 * 1000 : 55 * 60 * 1000

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () =>
      variant === "driver"
        ? getDriverBookingPhotos(bookingId)
        : getAdminBookingPhotos(bookingId),
    enabled: open,
    staleTime,
  })

  const totalCount = (data?.before.length ?? 0) + (data?.after.length ?? 0)

  return (
    <div className="border-t border-border/50 pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-1.5">
          <Camera className="size-3.5" />
          Photos
          {totalCount > 0 && (
            <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
              {totalCount}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {isError && (
            <p className="text-xs text-destructive">
              Impossible de charger les photos.
            </p>
          )}
          {data && (
            <>
              <PhaseRow
                label="Avant"
                bookingId={bookingId}
                phase="before"
                photos={data.before}
                canUpload={canUpload}
                uploadDisabled={false}
                queryKey={queryKey}
              />
              <PhaseRow
                label="Après"
                bookingId={bookingId}
                phase="after"
                photos={data.after}
                canUpload={canUpload}
                uploadDisabled={!canUploadAfter}
                queryKey={queryKey}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
