# transport24h-web — Instructions agent

## Stack

- **Runtime** : Node 22 LTS, version exacte `22.23.5` (image `node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a` dans les deux étages du
  `Dockerfile`, `node-version: "22.23.5"` en CI). Monter en version exacte publiée depuis au moins deux semaines.
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

## Content-Security-Policy à nonce (audit M8)

- Guide suivi : `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`. Politique construite par
  `buildCsp(nonce)` (`lib/csp.ts`), posée par `proxy.ts` sur **toutes les pages** (matcher
  `/((?!api|_next/static|_next/image|favicon.ico).*)`, préchargements compris : ils restent soumis à la redirection
  `/session`). Nonce neuf par requête (`generateNonce`), transmis à Next.js par les en-têtes de requête
  `Content-Security-Policy` et `x-nonce` ; Next.js l'ajoute seul à ses scripts. `next.config.ts` garde les autres
  en-têtes de sécurité, plus de CSP de page statique (CSP stricte dédiée sur `/api/*`, aucune sur `_next/static`).
- `script-src 'self' 'nonce-…' 'strict-dynamic' 'unsafe-inline' <domaines Stripe et Google>` (+ `'unsafe-eval'` en
  `next dev` seulement). En CSP3, `'unsafe-inline'` et les domaines sont IGNORÉS dès qu'un nonce et `'strict-dynamic'`
  sont présents (vérifié en navigateur : script inline injecté bloqué) ; ce sont des replis pour les navigateurs CSP2
  (Safari < 15.4, qui sinon bloqueraient Stripe) et CSP1 : ne pas les retirer. Stripe.js (`loadStripe`) et gtag.js
  (`lib/consent.ts`) sont créés par `document.createElement` depuis un script de confiance et héritent de la confiance. Effet de bord connu de `'strict-dynamic'` : tout code JS déjà exécuté
  peut créer un `<script>` (même inline) ; ce qui est bloqué, c'est le HTML injecté (script inline ou externe, même
  de `'self'`), les attributs `on*=`, `document.write`, `eval`/`new Function`.
- `frame-src` inclut `https://hooks.stripe.com` (3D Secure). Les réponses `/api/*` reçoivent une CSP stricte
  (`default-src 'none'; frame-ancestors 'none'; sandbox`) posée par `next.config.ts`.
- zod : importer uniquement `@/lib/zod` (mode `jitless`), jamais `zod` directement (règle ESLint).
- `style-src 'self' 'unsafe-inline'` gardé (attributs `style=` de Leaflet et des composants) : ne pas y ajouter de
  nonce, il ferait ignorer `'unsafe-inline'`. Autres directives identiques à l'ancienne CSP statique.
- Toutes les pages sont dynamiques (lecture de `x-nonce` dans `app/layout.tsx`) : plus de prérendu statique ni de
  cache CDN (`Cache-Control: private, no-store`). Ne pas réintroduire de page statique : ses scripts seraient bloqués.
- Script inline : jamais de `<script>` ou `dangerouslySetInnerHTML` sans nonce. `<Script>` de `next/script` : lui
  passer `nonce` lu par `(await headers()).get("x-nonce")`. Base UI (Slider, Tabs) émet des scripts inline avant
  hydratation : nonce fourni par `<CSPProvider>` dans `app/layout.tsx`.
- zod : importer `@/lib/zod`, jamais `"zod"` directement (`z.config({ jitless: true })` avant toute création de schéma ;
  sinon la sonde `new Function` de zod est signalée comme violation CSP).
- Tests : `tests/csp.test.ts`.

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

## Messages d'erreur

- Toute erreur d'appel API affichée à l'écran passe par `errorMessage(err, repli)` (`lib/error-message.ts`) :
  429 → « Trop de demandes en ce moment, réessayez dans N s. » (`retryAfter`), 503 → « Service momentanément
  indisponible, réessayez. », 403/409/413/422 → message métier de l'API (majuscule initiale), sinon le repli de
  l'écran (400, 404, 5xx, réseau). Traductions propres à un écran (409, 404…) testées **avant** l'appel au helper.
- 403 de rôle de la gateway (`rôle insuffisant : "client"`, RequireRole sur /admin/* et /driver/*) → « Accès
  réservé : cette page n'est pas disponible pour votre compte. ». Message technique (`Key: '`, `failed on the`,
  `sql`, `pq:`, `json:`, identifiant entre guillemets Go, ex. 422 du validateur sur l'assignation) → repli.
- Pas de retrait optimiste d'un élément qui porte sa propre mutation : la carte démontée perd l'erreur
  (ex. historique : le bouton « Accepter » du dashboard chauffeur, retiré le 20/11, ne retirait la course qu'après succès).
- Paiement (pas de message brut de l'API) : `transientErrorMessage(err) ?? repli` (429/503 seulement).
- `ApiError.message` est le texte de l'API, jamais le code : tester `err.status`, pas `message.includes("404")`.
- Liste `useQuery` : `error && liste vide` → encadré `role="alert"` (bordure `destructive/30`, `AlertCircle`) à la
  place de « Aucun… », en-tête « Liste indisponible ». React Query réessaie 3 fois avant l'erreur (quelques secondes).

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
- 422 CGV de l'API (« Vous devez accepter les CGV et la politique de confidentialité. », `isTermsRequiredError`) →
  `TERMS_REQUIRED_MESSAGE` à l'inscription et à l'activation. Activation : `acceptInvitationErrorMessage`
  (410 / 422 « lien d'invitation » → demander un nouveau lien, 422 mot de passe, 429/503 via `errorMessage`, sinon
  repli). Candidature partenaire : message de l'API affiché tel quel. Si l'API change ces textes, mettre à jour
  `lib/register.ts` et `tests/cgv-invitation-errors.test.ts`.
- Même case (composant `components/TermsCheckbox.tsx`, champ zod `acceptTermsField`, message `TERMS_REQUIRED_MESSAGE`)
  sur l'activation d'un compte entreprise (`buildAcceptInvitationBody` → POST /auth/accept-invitation) et la
  candidature partenaire (`buildPartnerApplyBody` → POST /partners). Champs construits par `termsAcceptanceFields`
  (`lib/legal.ts`). Pas de case pour les comptes créés par l'admin (chauffeurs salariés).
- Textes : ne rien affirmer qui ne soit prouvé par le code ou la config des deux dépôts. Une information manquante
  s'affiche en clair entre crochets (`ToComplete` dans la politique, encadré orange dans les CGV), jamais inventée.
  Les annulations des CGV suivent `computeRefund` de l'API (bornes : 24 h pile → 50 %, 2 h pile → 0 %).
- Cookies : Google Ads uniquement via `lib/consent.ts` (`sendAdsEvent`), jamais de `<Script>` Google direct.
- Tests : `npm test` (Node 22.23.5 ou plus, vérifié dans l'image Docker ; lancé en CI ; `node --test`, sans dépendance ; résolution des imports `@/` par
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

## Lot « ajustements » (2026-11-19/20, en prod)

- **Adresse d'une course payée** : `addressEditAction` (`lib/booking-status.ts`) — `price_locked === true` (statut modifiable, course à venir) → `ADDRESS_PAID_MESSAGE` + liens `/contact` et `contact@transport24h.fr` à la place du bouton ; champ absent (ancienne API) → bouton, le 409 de l'API s'affiche dans `EditAddressModal` (`err.message`, écart préexistant à `errorMessage`). Si l'API change ce message : `ADDRESS_PAID_MESSAGE` et `tests/address-edit.test.ts`.
- **Ajustement de prix admin** : `BookingCard` → `PriceAdjustmentModal`, logique pure `lib/price-adjustment.ts` (`canAdjustPrice` : price_locked, non B2B, non annulée, pas de débit en cours). Aperçu (anti-rebond 400 ms), case « Le client a donné son accord », confirmation explicite du montant et du sens. `request_id` (crypto.randomUUID) conservé après un résultat incertain (503, 500, 429, 401, réseau ; 409 pendant un nouvel essai) : champs verrouillés, seul « Réessayer » ; nouvel id seulement après succès ou refus définitif (402, 409/422 au premier essai). Historique : ligne `pending` → « Reprendre » (renvoie exactement `new_price_ht`, `reason`, `request_id` de la ligne, après confirmation ; seul l'admin d'origine peut reprendre). 409 « interrompu depuis plus de » et « déjà été envoyée avec d'autres paramètres » → flux arrêté (`isFinalConflict`, reconnu au texte : à mettre à jour si l'API change ces messages). Statut `succeeded` = succès, `failed` = échec (avec `failure_reason`), `pending` = en cours.
- **CGV** (version 2026-11-19, remplacée par 2026-11-20 pour la politique) : art. 5 « Modification d'une réservation payée » ; art. 1 et 6 « Comptes entreprises » (conditions particulières, pas de paiement en ligne ni de remboursement automatique).
- **Renvoi des invitations** : « Renvoyer l'invitation » (entreprise `invited` ou `expired`), « Renvoyer le lien » (candidature `pending`) via `lib/invitation-resend.ts` (`resendErrorMessage` : 429 → délai). Type `InvitationStatus` aligné sur l'API (`invited`, pas `sent`). Ouvert : « Inviter » (`inviteCompany`, POST sans corps → 400) toujours cassé, formulaire email/prénom/nom à faire.
- **Affectation par l'admin seulement** (`fix/affectation-admin-seulement`, règle client du 20/11) : le tableau de bord chauffeur n'affiche que « Mes missions à venir » et « Historique » ; `getAvailableBookings`, `acceptBooking`, `AvailableBooking` retirés. Politique de confidentialité §5 : seul le chauffeur affecté reçoit les informations de la course (adresses, date et heure, volume, manutentionnaires, téléphone du client) ; `TERMS_VERSION = "2026-11-20"`.

## Lot 2 (2026-11-21, en prod)

- **Invitation entreprise** : « Inviter » (statut `not_invited`) et juste après « Créer une entreprise » → `InviteCompanyModal` (email, prénom, nom). Logique pure `lib/company-invitation.ts` : `validateInviteForm` (bornes et format de l'API, longueurs en caractères), `buildInviteBody`, `inviteErrorMessage` (404, 429 de la limite reconnu au texte « renvoi déjà effectué », 422 avec champs traduits, sinon `errorMessage`). `createCompany` n'envoie plus que `name`. Si l'API change ces messages : `tests/company-invitation.test.ts`.
- **Documents partenaires avec jeton** : lien `/partners?id=<id>#token=<jeton>` ; `app/partners/page.tsx` lit le jeton dans le fragment (`lib/url-token.ts`) puis le retire de l'URL (`history.replaceState`), ou le reprend de la réponse de `POST /partners` (`upload_token`) ; envoi direct à l'API (pas via `/api/proxy`) avec l'en-tête `X-Upload-Token` (`lib/partner-upload.ts`), seulement si le jeton est connu. 401/403 → « Ce lien n'est plus valide : demandez un nouveau lien à Transport24h » + `/contact` et `contact@transport24h.fr`. Jeton gardé en mémoire seulement (recharger = rouvrir le lien du mail). Admin : « Copier le lien de reprise » retiré, « Renvoyer le lien » le remplace.
- **Désistement par l'admin** : dashboard chauffeur, sur une course assignée : « Pour vous désister d'une course, contactez l'administrateur » + `/contact` et mailto (aucun bouton de désistement : il n'y en a jamais eu). Admin (`lib/driver-assignment.ts`) : « Changer de chauffeur » sur une course assignée (sinon « Assigner un chauffeur »), « Retirer le chauffeur » (`DELETE /admin/bookings/{id}/assign`) avec confirmation, 409 affiché. Page partenaires : « Missions affectées » (plus de choix des créneaux ni de la zone). `TERMS_VERSION` inchangée (2026-11-20).

## Lot 3 (2026-11-21/23, en prod)

- **Chauffeur visible côté admin** : `driverDisplayName` (`lib/driver-assignment.ts`) → ligne « Chauffeur : Prénom Nom » sur `BookingCard` si l'API fournit `driver_first_name`/`driver_last_name`. `PUT /admin/bookings/{id}/assign` renvoie la course SEULE (type `Booking`, pas `BookingWithClient`) : ne jamais l'écrire dans le cache de la liste ; `refreshAfterAssign` invalide et recharge. Typer chaque réponse comme l'API la renvoie réellement.
- **Clôture d'un ajustement bloqué** (`PriceAdjustmentModal`, `lib/price-adjustment.ts`) : bouton « Clore » seulement si `closable_outcomes` est non vide ; issues « aucune opération », « opération effectuée » (identifiant `pi_`/`re_` par part), « partielle » (une ligne par part de `refund_parts`) ; confirmation « Clore définitivement » ; « Terminer la clôture » pour une clôture en suspens (« Reprendre » masqué). Ancienne API : aucun bouton.
- **Modale d'adresse** : `addressEditErrorMessage` (`lib/booking-status.ts`) passe par `errorMessage` ; 409 « déjà payée » reconnu au texte exact → `AddressPaidNotice` (liens `/contact`, mailto, partagé avec la carte) + `router.refresh()`. Si l'API change ce message : `ADDRESS_PAID_MESSAGE` et `tests/address-edit.test.ts`.
- `TERMS_VERSION` inchangée (2026-11-20). À monter quand la politique de confidentialité sera mise à jour pour l'observabilité (journaux conservés 30 jours ; texte proposé dans le README API `deployments/observability/`).

## Lot 4 (2026-11-24, en prod)

- **Relevé des courses par entreprise** : `components/BookingsReport.tsx` partagé entre `/admin/companies/[id]` (vue admin) et `/dashboard` d'un compte `b2b` (vue company, cookie `user_role` pour l'affichage seulement, l'API protège). Logique pure `lib/bookings-report.ts` : `recentMonths`/`monthRange` en dates civiles (mois courant à Paris), `reportPath` (vue company : jamais d'identifiant d'entreprise), `reportColumns`/`reportTotalsLines`/`sanitizeReport` (aucun prix, lien photos admin ni nom de famille du chauffeur en vue company, même si l'API les renvoyait), `photosApiPath` (`/admin/bookings/{id}/photos` seulement, appelé via `getReportPhotos`, jamais en lien), `cancelNoticeLabel`, `filenameFromDisposition`, `totalsNote` (« hors courses annulées »). Exports via `downloadBookingsReport` (blob) ; `/api/proxy` relaie `Content-Disposition`. 404/405 → « pas encore disponible ». Tests : `tests/bookings-report.test.ts`.
- Mise en page mobile de l'admin : traitée au lot 5.

## Lot 5 (2026-11-24, en prod)

- **Mobile (sujet 18)**, tout est limité à < 1024 px (`max-lg:`/`max-md:`/`max-sm:` ou `@media (width < 64rem)`) : l'ordinateur doit rester identique au pixel ; toute modification à ≥ 1024 px se fait hors de ces préfixes et se vérifie par comparaison de captures.
  - Admin : barre du haut + tiroir dans `components/admin-sidebar.tsx` (`aria-expanded`, `aria-controls`, Échap, fond, lien → `closeMenu` qui rend le focus au bouton, contenu `inert`, `body` en `overflow: hidden` tant que le tiroir est ouvert, fermeture au passage ≥ 1024 px). « Réduire » : ordinateur seulement.
  - Cibles 44 px par `max-lg:min-h-11` (et `min-w-11` pour les icônes) dans les primitives `components/ui/*` ; champs à 16 px par une règle globale hors `@layer` dans `app/globals.css` (pas de zoom iOS).
  - Modales : ancrées en haut, `max-h-[calc(100dvh-2rem)]`, `overflow-y-auto` ; `viewport` exporté par `app/layout.tsx` (`interactiveWidget: "resizes-content"`, pas de `maximumScale`).
  - Tableaux larges : cadre `overflow-x-auto` + `max-lg:min-w-*` ; le contenu admin porte `min-w-0` (sinon un tableau élargit la page).
  - Téléchargements : `saveBlob` (`lib/download.ts`), lien inséré avant le clic, URL révoquée après 60 s (Safari iOS). Tests : `tests/download.test.ts`.
  - Captures et banc Playwright : `~/work/review/captures-lot5/` (index `INDEX.md`). Bancs Playwright sur macOS : tout confiner (HOME, TMPDIR, cache npm, `PLAYWRIGHT_BROWSERS_PATH`, `downloadsPath`), aucune permission, garde-fou sur `input[type=file]`.
- Entreprise sur la course (sujet 19) : côté API uniquement ; un compte b2b sans entreprise reçoit un 403 à la réservation, affiché tel quel.

## CI, CD et npm audit (2026-11-24, en prod)

- CI : actions par SHA node24 (checkout v7.0.1, setup-node v7.1.0), Node 22.23.5 exact ; étapes `npm ci`, lint, `npm test`, build.
- CD : actions par SHA (checkout v7.0.1, login-action v4.8.0, setup-buildx-action v4.4.1, build-push-action v7.4.0 + `DOCKER_BUILD_SUMMARY=false`, qui évite un artefact contenant les build-args) ; appleboy/ssh-action remplacée par l'étape « Deploy via SSH » (`ssh` du runner, `ssh-agent`). Clé d'hôte vérifiée strictement (`StrictHostKeyChecking=yes`, seul known_hosts = secret `HETZNER_KNOWN_HOSTS`) : ne jamais contourner un « Host key verification failed. ».
- `package.json` : `overrides` exacts `source-map-js` 1.2.2 et `baseline-browser-mapping` 2.11.35 (avis npm de dépendances de next servant au build) ; `npm audit --omit=dev` doit rester à 0 ; relire ou retirer ces overrides à chaque montée de next ou de browserslist. Jamais `npm audit fix --force`.
- Image finale : npm, npx, corepack et yarn retirés (`Dockerfile`) ; le serveur ne lance que `node server.js`. Pas de `kubectl exec … npm` possible.
- `npm audit` ne voit pas les paquets vendus par Next (`next/dist/compiled` : compression, send, cookie, nanoid, picomatch, image-size, semver, ws…) : les recontrôler à chaque montée de Next. Avis de dev restants (shadcn, eslint) : voir le rapport du 24/11.

## Lot 6 (2026-11-25)

- **Node 22.23.5** en prod (digest d'index `1314fb30…`, manifeste amd64 inchangé depuis la publication). Les apk libssl3/libcrypto3 3.5.9-r0 et zlib 1.3.2-r1 de l'image officielle restent en retard sur la secdb Alpine : ils ne sont chargés que par `apk` et `ssl_client`, jamais par le serveur (Node embarque OpenSSL et zlib). Ne pas figer un apk en version exacte (Alpine ne garde que la dernière révision). À revoir le 02/12 ; option possible : `apk del apk-tools ssl_client` dans l'étage final (sujet dédié).
- **Politique de confidentialité** : branche `docs/politique-journaux` (journaux conservés 30 jours, `TERMS_VERSION = "2026-11-25"`) poussée, **non mergée** : à merger le jour de l'installation de l'observabilité, après Loki et avant Alloy, avec `TERMS_VERSION` à la date réelle (`lib/legal.ts` et `tests/register.test.ts`).
- Vérification du consentement : la bannière n'apparaît qu'après hydratation ; navigateur confiné en conteneur Playwright, réseau interne, requêtes Google interceptées.
