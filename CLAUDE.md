# transport24h-web — Instructions agent

## Stack

- **Framework** : Next.js 16 App Router, version figée exacte `16.4.5` dans `package.json` (correctifs de sécurité du 2026-11-03 ; monter en version exacte après audit, jamais de `^`) (voir `node_modules/next/dist/docs/` pour les conventions exactes — APIs et structure peuvent différer du training data)
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

## Breaking changes Next.js 16 (vs training data)

- **`middleware.ts` → `proxy.ts`** : le fichier s'appelle désormais `proxy.ts`, l'export `middleware` → `proxy`
- **`params` et `searchParams` sont des Promises** : `const { id } = await params` (plus de destructuring direct)
- **`cookies()` est async** : `const cookieStore = await cookies()`
- **`useSearchParams()`** doit toujours être dans un `<Suspense>` boundary
- **Tailwind v4** : `@import 'tailwindcss'` + `@theme inline { }` — pas de `tailwind.config.js`
- **shadcn base-nova** utilise `@base-ui/react` (pas Radix) — `render` prop à la place de `asChild`

## Avant d'écrire du code Next.js

Lire le guide pertinent dans `node_modules/next/dist/docs/` — les APIs, conventions et structure de fichiers peuvent avoir des breaking changes par rapport au training data.

## Textes légaux, consentement, tests

- `lib/legal.ts` : `TERMS_VERSION` (format API `^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$`) est la source unique :
  envoyée à l'inscription (`terms_version`) et affichée comme « dernière mise à jour » des CGV et de la
  politique de confidentialité. La changer à chaque modification de l'un de ces textes (même jour qu'une
  version déjà déployée : suffixe `.2`, `.3`… ; `formatTermsDate` n'affiche que les 10 premiers caractères).
- Inscription : corps construit par `buildRegisterBody` (`lib/register.ts`) — `terms_accepted` + `terms_version`
  seulement si la case est cochée, jamais de date (posée par le serveur), téléphone nettoyé (espaces, points,
  tirets). Les 422 de l'API sont traduits par `registerErrorMessage`.
- Même case (composant `components/TermsCheckbox.tsx`, champ zod `acceptTermsField`, message `TERMS_REQUIRED_MESSAGE`)
  sur l'activation d'un compte entreprise (`buildAcceptInvitationBody` → POST /auth/accept-invitation) et la
  candidature partenaire (`buildPartnerApplyBody` → POST /partners). Champs construits par `termsAcceptanceFields`
  (`lib/legal.ts`). Pas de case pour les comptes créés par l'admin (chauffeurs salariés).
- Textes : ne rien affirmer qui ne soit prouvé par le code ou la config des deux dépôts. Une information manquante
  s'affiche en clair entre crochets (`ToComplete` dans la politique, encadré orange dans les CGV), jamais inventée.
  Les annulations des CGV suivent `computeRefund` de l'API (bornes : 24 h pile → 50 %, 2 h pile → 0 %).
- Cookies : Google Ads uniquement via `lib/consent.ts` (`sendAdsEvent`), jamais de `<Script>` Google direct.
- Tests : `npm test` (Node >= 23.6, `node --test`, sans dépendance ; résolution des imports `@/` par
  `tests/ts-hooks.mjs`). Fichiers dans `tests/*.test.ts`.
