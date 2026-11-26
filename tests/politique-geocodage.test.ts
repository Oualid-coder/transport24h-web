import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const src = readFileSync(
  new URL("../app/(client)/politique-de-confidentialite/page.tsx", import.meta.url),
  "utf8",
)

// Recherche d'adresse par l'API (BAN, Géoplateforme IGN) : plus de Nominatim joint par le navigateur.
test("politique : géocodage IGN par nos serveurs, plus de Nominatim", () => {
  assert.ok(!src.includes("Nominatim"))
  assert.ok(!src.includes("nominatim.openstreetmap.org"))
  assert.ok(src.includes("Géoplateforme de l&apos;Institut national de"))
  assert.ok(src.includes("Base Adresse Nationale"))
  assert.ok(src.includes("votre navigateur ne le contacte pas, et l&apos;IGN ne reçoit ni"))
  assert.ok(src.includes("votre adresse IP ni aucune autre information vous concernant"))
  // Durées des caches de l'API (pkg/maps/geoplateforme.go : completionCacheTTL, searchCacheTTL, emptyCacheTTL)
  assert.ok(src.includes("24 heures pour l&apos;autocomplétion et 3 jours pour la recherche"))
  assert.ok(src.includes("(1 heure quand aucune adresse n&apos;est trouvée)"))
  assert.ok(!src.includes("30 jours pour la recherche"))
  // Tuiles de carte : toujours OpenStreetMap, contacté par le navigateur
  assert.ok(src.includes("tile.openstreetmap.org"))
  // Tableau des durées de conservation
  assert.ok(src.includes("Cache de la recherche d'adresses (adresses de la Base Adresse Nationale et leurs coordonnées, sans lien avec votre compte)"))
  assert.ok(src.includes("24 heures pour l'autocomplétion, 3 jours pour la recherche, 1 heure quand aucune adresse n'est trouvée, puis supprimé automatiquement"))
})
