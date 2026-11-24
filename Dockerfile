# ── Stage 1 : build ──────────────────────────────────────────────────────────
# Node 22 LTS, version exacte (Node 20 hors support depuis le 30/04/2026)
FROM node:22.23.4-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* variables sont inlinées dans le bundle client au moment du build.
# Il faut donc les passer en ARG (et les promouvoir en ENV) avant `next build`.
# Passer --build-arg NEXT_PUBLIC_API_URL=https://api.example.com au docker build.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

RUN npm run build

# ── Stage 2 : runner ─────────────────────────────────────────────────────────
FROM node:22.23.4-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Le serveur ne lance que `node server.js` : npm, npx, corepack et yarn livrés par
# l'image de base ne servent pas en prod, et leurs dépendances embarquées sont
# visées par des avis de sécurité. On les retire de l'image finale.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Le mode standalone produit un server.js autonome avec ses node_modules.
# .next/static et public/ doivent être copiés à part (non inclus dans standalone).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
