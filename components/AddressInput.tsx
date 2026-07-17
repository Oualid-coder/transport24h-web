"use client"

import { useState, useEffect, useRef, useCallback, useId } from "react"
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
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const didSelectRef = useRef(false)
  const isSelectingRef = useRef(false)

  const uid = useId()
  const listboxId = `${id ?? uid}-listbox`

  // Scroll automatique lors de la navigation clavier
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  // Ferme la dropdown au clic en dehors du composant
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener("mousedown", onOutsideClick)
    return () => document.removeEventListener("mousedown", onOutsideClick)
  }, [])

  // Recherche avec debounce 300ms
  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false
      return
    }
    didSelectRef.current = false

    const delay = value.trim().length < 3 ? 0 : 300
    const timer = setTimeout(async () => {
      if (value.trim().length < 3) {
        setSuggestions([])
        setIsOpen(false)
        setActiveIndex(-1)
        return
      }
      setIsLoading(true)
      const results = await searchAddresses(value)
      setSuggestions(results)
      setActiveIndex(-1)
      setIsOpen(true)
      setIsLoading(false)
    }, delay)

    return () => clearTimeout(timer)
  }, [value])

  const handleSelect = useCallback(
    (point: GeoPoint) => {
      isSelectingRef.current = true
      didSelectRef.current = true
      setValue(point.address)
      setSuggestions([])
      setIsOpen(false)
      setActiveIndex(-1)
      onSelect(point)
    },
    [onSelect],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || suggestions.length === 0) {
        if (e.key === "Escape") {
          setIsOpen(false)
          setActiveIndex(-1)
        }
        return
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
          break
        case "ArrowUp":
          e.preventDefault()
          setActiveIndex((prev) => Math.max(prev - 1, 0))
          break
        case "Enter":
          if (activeIndex >= 0) {
            e.preventDefault()
            const selected = suggestions[activeIndex]
            if (selected) handleSelect(selected)
          }
          break
        case "Escape":
          e.preventDefault()
          setIsOpen(false)
          setActiveIndex(-1)
          break
      }
    },
    [isOpen, suggestions, activeIndex, handleSelect],
  )

  // Fallback si l'utilisateur quitte le champ sans sélectionner de suggestion
  const handleBlur = useCallback(() => {
    setTimeout(async () => {
      if (didSelectRef.current || value.trim().length < 3) {
        setIsOpen(false)
        return
      }
      setIsOpen(false)
      setActiveIndex(-1)
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
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && activeIndex >= 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="pr-8"
        autoComplete="off"
      />

      {isLoading && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
      )}

      {isOpen && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-[9999] mt-1 w-full max-h-[300px] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
        >
          {suggestions.length === 0 ? (
            <li
              role="option"
              aria-selected={false}
              className="px-3 py-2 text-sm text-muted-foreground"
            >
              Aucun résultat
            </li>
          ) : (
            suggestions.map((s, index) => (
              <li
                key={`${s.lat},${s.lng}`}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(s)
                }}
                className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-sm ring-inset ${
                  index === activeIndex
                    ? "bg-accent text-accent-foreground ring-1 ring-primary"
                    : "hover:bg-accent hover:text-accent-foreground"
                }`}
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
