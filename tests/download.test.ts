// Téléchargement du relevé (sujet 18) : lien <a download> inséré avant le clic, URL blob révoquée
// tard (Safari iOS échoue si elle l'est avant d'avoir lu le fichier). Lancer : npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { REVOKE_DELAY_MS, saveBlob, type AnchorLike, type SaveBlobEnv } from "../lib/download"

function fakeEnv() {
  const log: string[] = []
  const timers: Array<{ fn: () => void; ms: number }> = []
  const anchor: AnchorLike & { inDom: boolean; clickedWith?: { href: string; download: string; inDom: boolean } } = {
    href: "",
    download: "",
    inDom: false,
    click() {
      this.clickedWith = { href: this.href, download: this.download, inDom: this.inDom }
      log.push("click")
    },
    remove() {
      this.inDom = false
      log.push("remove")
    },
  }
  const env: SaveBlobEnv<typeof anchor> = {
    createAnchor: () => anchor,
    append: (a) => {
      a.inDom = true
      log.push("append")
    },
    createObjectURL: () => {
      log.push("create")
      return "blob:http://localhost/1234"
    },
    revokeObjectURL: (u) => log.push(`revoke ${u}`),
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
  }
  return { env, anchor, log, timers }
}

test("saveBlob : lien dans le document au clic, nom de fichier, URL blob", () => {
  const { env, anchor, log } = fakeEnv()
  saveBlob(new Blob(["x"]), "releve-2026-11.xlsx", env)
  assert.deepEqual(anchor.clickedWith, { href: "blob:http://localhost/1234", download: "releve-2026-11.xlsx", inDom: true })
  assert.deepEqual(log, ["create", "append", "click", "remove"])
})

test("saveBlob : URL révoquée seulement après le délai, jamais au clic", () => {
  const { env, log, timers } = fakeEnv()
  saveBlob(new Blob(["x"]), "releve.pdf", env)
  assert.ok(!log.some((l) => l.startsWith("revoke")), "révoquée trop tôt")
  assert.equal(timers.length, 1)
  assert.equal(timers[0].ms, REVOKE_DELAY_MS)
  assert.ok(REVOKE_DELAY_MS >= 60_000, "laisser le temps à la confirmation de Safari iOS")
  timers[0].fn()
  assert.equal(log.at(-1), "revoke blob:http://localhost/1234")
})
