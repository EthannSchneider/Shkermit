# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS backend-dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build/backend
COPY backend/package.json backend/package-lock.json backend/prisma.config.ts ./
COPY backend/prisma/ ./prisma/
RUN npm ci

FROM node:22-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_URL=file:/app/backend/data/shkermit.db \
    PICTURE_UPLOAD_DIR=/app/backend/data/files/pictures

WORKDIR /app/backend
COPY --from=backend-dependencies /build/backend/node_modules ./node_modules
COPY --chown=node:node backend/ ./
COPY --from=frontend-build --chown=node:node /build/frontend/dist ./public

RUN mkdir -p data/files/pictures/uploads \
    && chown -R root:root data public

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npm run db:migrate:deploy && exec node src/server.js"]
