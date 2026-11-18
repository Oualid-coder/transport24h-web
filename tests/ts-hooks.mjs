// Résolution des imports TypeScript pour `node --test` (Node >= 23.6, sans dépendance) :
// alias "@/x" → <racine>/x, et imports sans extension → .ts / .tsx / index.ts.
import { registerHooks } from "node:module"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const root = new URL("../", import.meta.url)

registerHooks({
  resolve(specifier, context, nextResolve) {
    let url
    if (specifier.startsWith("@/")) url = new URL(specifier.slice(2), root).href
    else if (specifier.startsWith(".") && context.parentURL && !context.parentURL.includes("/node_modules/"))
      url = new URL(specifier, context.parentURL).href
    // Points d'entrée Next sans champ "exports" (route handlers testés) : extension explicite
    else if (specifier === "next/server" || specifier === "next/headers")
      return nextResolve(`${specifier}.js`, context)
    else return nextResolve(specifier, context)

    if (!/\.[cm]?[jt]sx?$/.test(url)) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(fileURLToPath(url + ext))) return nextResolve(url + ext, context)
      }
    }
    return nextResolve(url, context)
  },
})
