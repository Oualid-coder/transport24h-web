"use client"

import { useState, useEffect, useRef, useCallback, useId } from "react"
import { Loader2, MapPin, RotateCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { searchAddresses } from "@/lib/api"
import {
  ADDRESS_CHOOSE_MESSAGE,
  ADDRESS_DEBOUNCE_MS,
  ADDRESS_NOT_FOUND_MESSAGE,
  ADDRESS_QUERY_MAX,
  addressQuery,
  addressSearchErrorMessage,
  isInvalidQueryError,
  selectionAfterEdit,
  type AddressResult,
} from "@/lib/address-search"
import type { GeoPoint } from "@/lib/types"

interface AddressInputProps {
  id?: string
  placeholder?: string
  // Adresse choisie dans la liste, puis null dès que le texte ne correspond plus à ce choix :
  // jamais de coordonnées anciennes, approximatives ou choisies automatiquement.
  onSelect: (point: GeoPoint | null) => void
  // Texte affiché, à chaque modification (frappe ou choix) : sert à refuser un envoi
  // avec un texte tapé mais aucune adresse retenue (isUnconfirmedAddress).
  onTextChange?: (text: string) => void
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError"
}

export function AddressInput({ id, placeholder, onSelect, onTextChange }: AddressInputProps) {
  const [value, setValue] = useState("")
  const [suggestions, setSuggestions] = useState<AddressResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  // Service indisponible (503, réseau, réponse invalide, 429) : message + « Réessayer »
  const [error, setError] = useState<string | null>(null)
  // Texte non reconnu avec certitude : l'adresse doit être choisie dans la liste
  const [hint, setHint] = useState<string | null>(null)
  // Incrémenté par « Réessayer » : relance la recherche sans délai de frappe
  const [retryToken, setRetryToken] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const selectedRef = useRef<GeoPoint | null>(null)
  const valueRef = useRef("")
  // Dernières suggestions reçues (lues au départ du champ)
  const suggestionsRef = useRef<AddressResult[]>([])
  // Texte dont les suggestions affichées sont la réponse (null : réponse attendue)
  const searchedRef = useRef<string | null>(null)
  const isSelectingRef = useRef(false)

  const uid = useId()
  const baseId = id ?? uid
  const listboxId = `${baseId}-listbox`
  const statusId = `${baseId}-status`

  useEffect(() => {
    suggestionsRef.current = suggestions
  }, [suggestions])

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

  // Autocomplétion après une pause de frappe ; la requête précédente est annulée
  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false
      return
    }
    const q = addressQuery(value)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (!q) {
        setSuggestions([])
        setIsOpen(false)
        setActiveIndex(-1)
        return
      }
      setIsLoading(true)
      try {
        const results = await searchAddresses(q, controller.signal)
        setError(null)
        suggestionsRef.current = results
        searchedRef.current = q
        setSuggestions(results)
        setIsOpen(true)
        // Champ déjà quitté sans choix : l'invite suit les suggestions arrivées entre-temps
        setHint((h) => (h === null ? null : results.length > 0 ? ADDRESS_CHOOSE_MESSAGE : ADDRESS_NOT_FOUND_MESSAGE))
      } catch (err) {
        if (isAbort(err)) return
        setSuggestions([])
        if (isInvalidQueryError(err)) {
          setIsOpen(true)
        } else {
          setError(addressSearchErrorMessage(err))
          setIsOpen(false)
        }
      } finally {
        if (!controller.signal.aborted) {
          setActiveIndex(-1)
          setIsLoading(false)
        }
      }
    }, !q || retryToken > 0 ? 0 : ADDRESS_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, retryToken])

  const select = useCallback(
    (point: AddressResult) => {
      const chosen: GeoPoint = { lat: point.lat, lng: point.lng, address: point.address }
      isSelectingRef.current = true
      selectedRef.current = chosen
      valueRef.current = chosen.address
      setValue(chosen.address)
      setSuggestions([])
      setIsOpen(false)
      setActiveIndex(-1)
      setError(null)
      setHint(null)
      onTextChange?.(chosen.address)
      onSelect(chosen)
    },
    [onSelect, onTextChange],
  )

  const handleChange = useCallback(
    (text: string) => {
      valueRef.current = text
      setValue(text)
      setHint(null)
      setRetryToken(0)
      onTextChange?.(text)
      // Texte modifié après un choix : l'ancienne adresse ne vaut plus pour le devis
      if (selectedRef.current !== null && selectionAfterEdit(selectedRef.current, text) === null) {
        selectedRef.current = null
        onSelect(null)
      }
    },
    [onSelect, onTextChange],
  )

  const handleRetry = useCallback(() => {
    setError(null)
    setRetryToken((n) => n + 1)
  }, [])

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
            if (selected) select(selected)
          }
          break
        case "Escape":
          e.preventDefault()
          setIsOpen(false)
          setActiveIndex(-1)
          break
      }
    },
    [isOpen, suggestions, activeIndex, select],
  )

  // Champ quitté sans choisir : aucune adresse retenue, jamais de choix automatique. La liste
  // des suggestions est proposée de nouveau avec « Choisissez votre adresse dans la liste. ».
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (selectedRef.current !== null || !addressQuery(valueRef.current)) {
        setIsOpen(false)
        return
      }
      setActiveIndex(-1)
      // Suggestions encore attendues (frappe rapide) : invite à choisir, corrigée à leur arrivée
      const n = suggestionsRef.current.length
      setIsOpen(n > 0)
      const settled = searchedRef.current === addressQuery(valueRef.current)
      setHint(n > 0 || !settled ? ADDRESS_CHOOSE_MESSAGE : ADDRESS_NOT_FOUND_MESSAGE)
    }, 150)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-describedby={error || hint ? statusId : undefined}
        aria-activedescendant={
          isOpen && activeIndex >= 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="pr-8"
        autoComplete="off"
        maxLength={ADDRESS_QUERY_MAX}
      />

      {isLoading && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
      )}

      {error ? (
        <div id={statusId} role="alert" className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-destructive">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1 rounded font-medium underline underline-offset-2 hover:no-underline max-lg:min-h-11"
          >
            <RotateCw className="size-3" />
            Réessayer
          </button>
        </div>
      ) : hint ? (
        <p id={statusId} aria-live="polite" className="mt-1.5 text-xs text-amber-500">
          {hint}
        </p>
      ) : null}

      {isOpen && (
        <div className="absolute z-[9999] mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="max-h-[300px] overflow-y-auto"
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
                  key={`${s.lat},${s.lng},${s.address}`}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    select(s)
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
          <p className="border-t border-border px-3 py-1 text-[11px] text-muted-foreground">
            Adresses : Base Adresse Nationale (IGN)
          </p>
        </div>
      )}
    </div>
  )
}
