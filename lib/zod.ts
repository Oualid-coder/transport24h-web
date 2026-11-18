// zod sans compilation JIT : sinon zod teste `new Function("")` à la création de chaque z.object,
// ce que la CSP (script-src sans 'unsafe-eval') signale comme violation même si l'erreur est avalée.
// Importer zod via ce module garantit que la configuration précède toute création de schéma.
import * as z from "zod"

z.config({ jitless: true })

export * from "zod"
