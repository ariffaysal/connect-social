# ConnectSocial backend (NestJS API + WebSocket hub).
#
# Built from the repository root so the npm workspace lockfile is available:
#   docker build -f backend/Dockerfile -t connectsocial-api .

# ---------------------------------------------------------------------------
# Build stage: compile TypeScript with the full (dev) dependency set.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Manifests first, so dependency installation is cached independently of source.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY backend ./backend
RUN npm --workspace backend run build

# ---------------------------------------------------------------------------
# Runtime stage: production dependencies + compiled output only.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/backend/dist ./backend/dist

# Uploaded images live here. docker-compose mounts a persistent volume over it;
# because the directory exists in the image with the right owner, the volume is
# initialized writable by the unprivileged `node` user.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
ENV UPLOAD_DIR=/app/uploads
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "backend/dist/main.js"]
