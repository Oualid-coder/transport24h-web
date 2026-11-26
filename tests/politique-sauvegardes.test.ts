import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const src = readFileSync(
  new URL("../app/(client)/politique-de-confidentialite/page.tsx", import.meta.url),
  "utf8",
)

// Copie chiffrée des sauvegardes hors serveur (API : deployments/k8s/backup-offsite-cronjob.yaml,
// bucket Cloudflare R2 en juridiction UE, rétention 30 jours portée par le bucket).
test("politique : copie chiffrée des sauvegardes chez Cloudflare R2, durées", () => {
  assert.ok(
    src.includes(
      "Sur notre serveur, chaque sauvegarde est supprimée automatiquement au bout de 8 à 9 jours ; sa copie chiffrée conservée hors de notre serveur (Cloudflare R2, Union européenne) est supprimée automatiquement au bout de 30 à 31 jours",
    ),
  )
  assert.ok(!src.includes("Sauvegarde quotidienne, chaque sauvegarde étant supprimée automatiquement au bout de 8 à 9 jours"))
  assert.ok(src.includes("partenaires et des photos d&apos;état des lieux, ainsi que conservation"))
  assert.ok(src.includes("d&apos;une copie de secours quotidienne de la base de données, chiffrée sur"))
  assert.ok(src.includes("notre serveur avant son envoi (Cloudflare ne détient pas la clé permettant de"))
  assert.ok(
    src.includes(
      'la lire) et stockée dans l&apos;Union européenne.{" "}\n              <ToComplete>entité contractante et localisation du stockage à confirmer</ToComplete>',
    ),
  )
  assert.ok(src.includes("transferts éventuels vers Cloudflare, Inc. (États-Unis) et leur encadrement à confirmer"))
})
