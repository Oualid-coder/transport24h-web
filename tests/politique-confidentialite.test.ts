import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const src = readFileSync(
  new URL("../app/(client)/politique-de-confidentialite/page.tsx", import.meta.url),
  "utf8",
)

// Durée alignée sur retention_period: 720h de Loki (API, deployments/observability/loki.yaml)
test("politique : journaux techniques conservés 30 jours, plus de durée à compléter", () => {
  assert.ok(
    src.includes(
      "Conservés 30 jours dans un outil de journalisation hébergé sur le même serveur (Hetzner), puis supprimés automatiquement.",
    ),
  )
  assert.ok(src.includes("Finalité : sécurité de la plateforme et diagnostic des incidents ; base légale : intérêt légitime."))
  assert.ok(!src.includes("sans base de journaux dédiée"))
  assert.ok(!src.includes("configuration de l&apos;hébergement"))
})
