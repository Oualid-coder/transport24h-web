# ── Stage 1 : build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* variables sont inlinées dans le bundle client au moment du build.
# Il faut donc les passer en ARG (et les promouvoir en ENV) avant `next build`.
# Passer --build-arg NEXT_PUBLIC_API_URL=https://api.example.com au docker build.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ── Stage 2 : runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

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
