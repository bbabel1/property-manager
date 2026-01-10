FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV PATH="/app/node_modules/.bin:${PATH}"

# System deps needed for optional native modules (sharp, etc.)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 build-essential pkg-config \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS dev
ENV NODE_ENV=development
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
CMD ["npm", "run", "dev"]

FROM base AS builder
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for runtime
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --gid 1001 nextjs \
  && mkdir -p /app \
  && chown -R nextjs:nodejs /app

COPY package*.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=deps /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000
CMD ["npm", "run", "start"]
