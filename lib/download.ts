// Enregistrement d'un fichier reçu en Blob (relevé Excel / PDF) : lien <a download> sur une URL blob.
// Garde le passage par fetch (renouvellement de session, messages d'erreur) au lieu d'une navigation
// directe vers l'API.
// - Lien inséré dans le document avant le clic (Firefox, anciens WebKit ignorent un lien détaché),
//   sans target (Safari ouvrirait un onglet « WebKitBlobResource error »).
// - URL révoquée tard : Safari iOS fait échouer le téléchargement si l'URL est révoquée avant qu'il
//   l'ait lue (WebKit bug 211234, « WebKitBlobResource error 1 »), et il demande d'abord à
//   l'utilisateur de confirmer le téléchargement ; 10 s ne suffisaient pas si la confirmation tarde.

export const REVOKE_DELAY_MS = 60_000

export interface AnchorLike {
  href: string
  download: string
  click(): void
  remove(): void
}

export interface SaveBlobEnv<A extends AnchorLike> {
  createAnchor(): A
  append(anchor: A): void
  createObjectURL(blob: Blob): string
  revokeObjectURL(url: string): void
  setTimeout(fn: () => void, ms: number): unknown
}

function browserEnv(): SaveBlobEnv<HTMLAnchorElement> {
  return {
    createAnchor: () => document.createElement("a"),
    append: (a) => {
      a.style.display = "none"
      document.body.appendChild(a)
    },
    createObjectURL: (b) => URL.createObjectURL(b),
    revokeObjectURL: (u) => URL.revokeObjectURL(u),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  }
}

// env : navigateur par défaut ; remplacé dans les tests (tests/download.test.ts).
export function saveBlob(blob: Blob, filename: string, env: SaveBlobEnv<AnchorLike> = browserEnv()): void {
  const url = env.createObjectURL(blob)
  const a = env.createAnchor()
  a.href = url
  a.download = filename
  env.append(a)
  a.click()
  a.remove()
  env.setTimeout(() => env.revokeObjectURL(url), REVOKE_DELAY_MS)
}
