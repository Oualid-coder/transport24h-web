"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useRef } from "react"
import type { GeoPoint } from "@/lib/types"

interface DevisMapProps {
  origin: GeoPoint | null
  destination: GeoPoint | null
  className?: string
}

export function DevisMap({ origin, destination, className }: DevisMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const markersRef = useRef<import("leaflet").Marker[]>([])
  const routeLayerRef = useRef<import("leaflet").Polyline | null>(null)

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return

      // Fix default marker icons broken by bundler asset hashing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        iconUrl: "/leaflet/marker-icon.png",
        shadowUrl: "/leaflet/marker-shadow.png",
      })

      const map = L.map(containerRef.current!, {
        center: [46.603354, 1.888334], // centre France
        zoom: 5,
        zoomControl: true,
      })

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
        },
      ).addTo(map)

      mapRef.current = map
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Update markers and route when origin/destination change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    import("leaflet").then(async (L) => {
      // Clear previous markers and route
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      if (routeLayerRef.current) {
        routeLayerRef.current.remove()
        routeLayerRef.current = null
      }

      const blueIcon = new L.Icon({
        iconUrl: "/leaflet/marker-icon.png",
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        shadowUrl: "/leaflet/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      })

      if (origin) {
        const m = L.marker([origin.lat, origin.lng], { icon: blueIcon })
          .addTo(map)
          .bindPopup(`<b>Départ</b><br>${origin.address}`)
        markersRef.current.push(m)
      }

      if (destination) {
        const m = L.marker([destination.lat, destination.lng], {
          icon: blueIcon,
        })
          .addTo(map)
          .bindPopup(`<b>Arrivée</b><br>${destination.address}`)
        markersRef.current.push(m)
      }

      if (origin && destination) {
        // Fetch route via Next.js proxy — OSRM ne doit jamais être appelé directement depuis le browser
        try {
          const url = `/api/route?from_lat=${origin.lat}&from_lng=${origin.lng}&to_lat=${destination.lat}&to_lng=${destination.lng}`
          const res = await fetch(url)
          if (res.ok) {
            const data = (await res.json()) as {
              routes: Array<{
                geometry: { coordinates: [number, number][] }
              }>
            }
            const coords = data.routes[0]?.geometry?.coordinates
            if (coords) {
              const latlngs = coords.map(
                ([lng, lat]) => [lat, lng] as [number, number],
              )
              routeLayerRef.current = L.polyline(latlngs, {
                color: "#3b82f6",
                weight: 4,
                opacity: 0.8,
              }).addTo(map)
            }
          }
        } catch {
          // OSRM unavailable — just show markers
        }

        // Fit bounds to show both markers
        const bounds = L.latLngBounds([
          [origin.lat, origin.lng],
          [destination.lat, destination.lng],
        ])
        map.fitBounds(bounds, { padding: [40, 40] })
      } else if (origin) {
        map.setView([origin.lat, origin.lng], 12)
      } else if (destination) {
        map.setView([destination.lat, destination.lng], 12)
      }
    })
  }, [origin, destination])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} className={className ?? "h-full w-full"} />
}
