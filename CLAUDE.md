# transport24h-web — Instructions agent

## Stack

- **Framework** : Next.js 14 App Router (voir `node_modules/next/dist/docs/` pour les conventions exactes — APIs et structure peuvent différer du training data)
- **Langage** : TypeScript strict (`"strict": true` dans tsconfig)
- **Style** : Tailwind CSS
- **Composants** : shadcn/ui

## Conventions TypeScript

- `any` interdit — utiliser `unknown` ou typer précisément
- Pas de cast `as Type` sauf si inévitable et commenté
- Types dans des fichiers dédiés `types/` ou co-localisés avec le module

## Composants React / Next.js

- Server Components par défaut — ne pas ajouter `"use client"` sans raison explicite
- `"use client"` uniquement pour : state local, event handlers, hooks navigateur, bibliothèques client-only
- Pas de `useEffect` pour fetcher des données — utiliser les Server Components ou React Server Actions

## Appels API

- Tous les appels vers le backend passent par `lib/api.ts` — ne pas appeler `fetch` directement dans les composants
- URL de base : `process.env.NEXT_PUBLIC_API_URL` (défini dans `.env.local`)
- Ne jamais hardcoder d'URL ou de hostname

## Structure des routes

```
app/
  (client)/      # Pages publiques (client final)
  (admin)/       # Backoffice — protégé, accès restreint
  (driver)/      # Espace chauffeur — protégé
```

Les route groups `(client)`, `(admin)`, `(driver)` n'apparaissent pas dans les URLs.

## Variables d'environnement

- `.env.local` est le seul fichier d'env local — ne pas le modifier, ne pas le lire, ne pas y écrire
- Les variables `NEXT_PUBLIC_*` sont exposées côté client
- Ne jamais exposer de secrets côté client

## Git

- Pas de mention de Claude, AI, ou assistant dans les messages de commit
- Pas de `Co-Authored-By` AI dans les commits
- Ne pas faire de `git push` — c'est à l'utilisateur de pusher
- Ne pas créer de branches sans instruction explicite

## Ce que l'agent ne doit PAS faire

- Push Git (ni force push, ni push simple)
- Modifier `.env.local` ou tout fichier `.env*`
- Hardcoder des URLs, tokens, ou secrets
- Installer des dépendances sans approbation explicite
- Créer des fichiers de documentation non demandés

## Avant d'écrire du code Next.js

Lire le guide pertinent dans `node_modules/next/dist/docs/` — les APIs, conventions et structure de fichiers peuvent avoir des breaking changes par rapport au training data.
