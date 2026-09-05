# ── deps ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Prisma's engines need OpenSSL, which the alpine base image omits.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# The Prisma client is generated code; build it against the same schema the
# runtime will use, so the engine binary matches this platform.
COPY prisma ./prisma
RUN npx prisma generate

# ── runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl tini

ENV NODE_ENV=production \
    PORT=5000 \
    STORAGE_DIR=/data/projects

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts

# Project files are user data — keep them on a volume, not in the image layer.
RUN mkdir -p /data/projects && chown -R node:node /data
VOLUME ["/data/projects"]

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps zombies and forwards SIGTERM so the graceful shutdown in index.js
# actually runs.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
