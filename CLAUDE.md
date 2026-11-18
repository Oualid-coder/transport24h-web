# transport24h-web — Instructions agent

## Stack

- **Runtime** : Node 22 LTS, version exacte `22.23.4` (image `node:22.23.4-alpine` dans les deux étages du
  `Dockerfile`, `node-version: "22.23.4"` en CI). Monter en version exacte publiée depuis au moins deux semaines.
- **Dépendances figées** : `next` 16.4.5, `react`/`react-dom` 19.2.4, `zod` 4.6.6, `shadcn` 4.2.0 (CLI, en
  `devDependencies` : seul `app/globals.css` l'importe, à la compilation). Toute montée : version exacte
  (`--save-exact`) après audit.
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
- Appels serveur (Route Handlers `/api/proxy`, `/api/auth/login`, Server Component `dashboard`) : base
  `process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL`. En prod `API_URL` = gateway interne
  (`deployments/k8s/deployment.yaml`, appliqué à la main : le CD ne fait que `kubectl set image`). Jamais
  `API_URL` dans du code client. Chaque appel serveur transmet l'IP du visiteur avec `clientIpHeaders`
  (`lib/client-ip.ts` : `x-real-ip` entrant posé par l'ingress, IP validée, sinon rien ; jamais
  `x-forwarded-for` ni `true-client-ip`).

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

## Route Handlers `/api/proxy`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`

- `lib/request-guard.ts` : POST/PUT/PATCH/DELETE avec un `Origin` dont l'hôte diffère de `x-forwarded-host`
  (sinon `Host`) → 403 (`isCrossOriginMutation`) ; `Origin` absent accepté. Login : `Content-Type:
  application/json` exigé (415 sinon, login CSRF par formulaire `text/plain`). Proxy : segments ré-encodés
  (`proxyPath`), `.`, `..` et segment vide → 400. Tout nouveau Route Handler modifiant doit appeler le même contrôle.

## Session et refresh (audit M5, contrat `internal/handler/auth.go` de l'API)

- API : `POST /auth/refresh` lit `refresh_token` dans l'en-tête **Cookie** uniquement (jamais le corps), renvoie
  `{access_token, expires_in: 900}`, **sans rotation** du refresh ; 401 absent/invalide/expiré/révoqué, 403 compte
  désactivé ; 10/min par IP à la gateway. `POST /auth/logout` lit le même cookie, le met en liste noire, 204.
  Refresh token : 7 j (Max-Age 604800), posé par l'API en `Path=/auth` (invisible pour les routes du site).
- `lib/session-cookies.ts` : source unique des cookies. Login et refresh posent `access_token` (httpOnly, Lax, `/`,
  `expires_in`), `user_role` (Lax, `/`) et `refresh_token` reposé en `Path=/api/auth` (httpOnly, **Strict**, Max-Age
  de l'API), Secure en production. `clearSessionCookies` efface aussi l'ancien `refresh_token` en `Path=/auth`
  (en-tête brut ajouté en dernier : `response.cookies` est indexé par nom).
- `/api/auth/refresh` (POST, garde d'origine, `X-Real-IP`) : cookie absent ou API 401/403 → même statut + cookies
  effacés (« Session expirée ») ; 429 « Trop de demandes » (Retry-After relayé), 5xx « Service momentanément
  indisponible », réseau et `expires_in` absent ou `<= 0` → 502 : cookies gardés, rien posé. Rotation gérée si l'API
  pose un jour un Set-Cookie.
- `/api/auth/logout` : appelle `/auth/logout` de l'API avec le refresh (timeout 5 s, erreur ignorée), puis efface tout.
- Client (`lib/api.ts`) : `refreshSession()` → `ok | unauthorized | rateLimited(retryAfter) | unavailable` (une seule
  promesse en vol partagée). `fetchWithRefresh` (utilisé par `apiResponse` et `uploadBookingPhoto`) → sur 401, un seul
  refresh puis un seul rejeu ; `unauthorized` → redirection `/login` ; `rateLimited` / `unavailable` → `ApiError` 429
  (avec `retryAfter`) / 503 et `refreshErrorMessage`, **sans redirection** (le formulaire garde sa saisie). Raison :
  `/auth/refresh` est limité à 10/min par IP à la gateway, et tant que l'ingress n'est pas en
  `externalTrafficPolicy: Local`, tous les visiteurs partagent une IP. Corps `ReadableStream` jamais rejoué
  (`isReplayableBody`) ; `File`/`Blob`/chaîne le sont.
- `proxy.ts` : page protégée sans `access_token` → `/session?redirect=…` (pas `/login`) : la page client
  `app/session/page.tsx` appelle `resumeSession` (refresh, puis navigation complète). Sans redirection valide :
  accueil du rôle (`user_role`). 429 / indisponible : message, bouton « Réessayer », lien « Se reconnecter », un seul
  nouvel essai automatique si `Retry-After` ≤ 60 s. Gardes anti-boucle : après un refresh réussi, `document.cookie`
  doit contenir `user_role=` (posé avec `access_token`), sinon `/login` ; en complément
  `sessionStorage["session-resume-at"]` (15 s, ignoré si le stockage lève).
- Non couverts : `window.open` de la facture PDF admin (`/api/proxy/.../pdf`), Server Component `dashboard`
  (rend `[]` sur 401 dans la fenêtre où le cookie survit au jeton), navbar des pages publiques (`isLoggedIn` lit
  `access_token`, faux après 15 min d'inactivité jusqu'à la prochaine page protégée ou requête API).
- Sessions ouvertes avant ce correctif (refresh en `Path=/auth`) : non renouvelables ni révocables par le web ;
  reconnexion à l'expiration de l'access token, comme avant.

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
- Tests : `npm test` (Node 22.23.4 ou plus, vérifié dans l'image Docker ; lancé en CI ; `node --test`, sans dépendance ; résolution des imports `@/` par
  `tests/ts-hooks.mjs`). Fichiers dans `tests/*.test.ts`.

## Vérification d'email (contrat API `feat/email-verification-v2`)

- Lien reçu : `/verify-email?token=<base64url>` (public, hors `PROTECTED_PREFIXES` de `proxy.ts`). Page client
  sous `<Suspense>` : un seul appel `verifyEmail` (`lib/api.ts`, via `/api/proxy`) après chargement, jamais au
  rendu serveur (les scanners de liens consommeraient le jeton à usage unique). 200 succès, 400/422/réseau →
  `verifyEmailErrorMessage` (`lib/email-verification.ts`).
- L'API n'expose `email_verified` que dans la réponse de `POST /auth/register` (ni JWT, ni endpoint « moi »).
  Après inscription, `registeredLoginUrl` (`lib/register.ts`) ajoute `verify=sent` si `email_verified === false`.
- Bandeau `EmailUnverifiedBanner` : uniquement après un 403 reconnu par `isEmailNotVerifiedError` (message
  « vérifiez votre email avant de réserver / de payer »). Tout autre 403 garde son message. Ne pas déduire l'état
  d'un drapeau local.
- Renvoi `POST /auth/resend-verification` : 429 avec `Retry-After` (5/h par compte, 3/min par IP à la gateway).
  Le proxy relaie `Retry-After`, `ApiError.retryAfter` le porte, `resendErrorMessage` l'affiche.
- Si l'API change un de ces messages 403, mettre à jour `isEmailNotVerifiedError` et `tests/email-verification.test.ts`.
