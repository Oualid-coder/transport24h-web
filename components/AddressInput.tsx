"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Loader2, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { geocodeAddress, searchAddresses } from "@/lib/api"
import type { GeoPoint } from "@/lib/types"

interface AddressInputProps {
  id?: string
  placeholder?: string
  onSelect: (point: GeoPoint) => void
}

export function AddressInput({ id, placeholder, onSelect }: AddressInputProps) {
  const [value, setValue] = useState("")
  const [suggestions, setSuggestions] = useState<GeoPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // Vrai dès qu'une suggestion (ou le fallback) a été sélectionnée pour l'input en cours
  const didSelectRef = useRef(false)

  // Ferme la dropdown au clic en dehors du composant
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", onOutsideClick)
    return () => document.removeEventListener("mousedown", onOutsideClick)
  }, [])

  // Recherche avec debounce 300ms
  useEffect(() => {
    // Réinitialise le flag de sélection à chaque frappe
    didSelectRef.current = false

    if (value.trim().length < 3) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      const results = await searchAddresses(value)
      setSuggestions(results)
      setIsOpen(true)
      setIsLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [value])

  const handleSelect = useCallback(
    (point: GeoPoint) => {
      didSelectRef.current = true
      setValue(point.address)
      setSuggestions([])
      setIsOpen(false)
      onSelect(point)
    },
    [onSelect],
  )

  // Fallback si l'utilisateur quitte le champ sans sélectionner de suggestion
  const handleBlur = useCallback(() => {
    setTimeout(async () => {
      if (didSelectRef.current || value.trim().length < 3) {
        setIsOpen(false)
        return
      }
      setIsOpen(false)
      setIsLoading(true)
      const result = await geocodeAddress(value)
      setIsLoading(false)
      if (result) {
        didSelectRef.current = true
        setValue(result.address)
        onSelect(result)
      }
    }, 150)
  }, [value, onSelect])

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        className="pr-8"
        autoComplete="off"
      />

      {isLoading && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
      )}

      {isOpen && (
        <ul className="absolute z-[9999] mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Aucun résultat
            </li>
          ) : (
            suggestions.map((s) => (
              <li
                key={`${s.lat},${s.lng}`}
                // onMouseDown + preventDefault empêche le blur de l'input avant le clic
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(s)
                }}
                className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2">{s.address}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
