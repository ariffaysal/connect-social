# ConnectSocial frontend (Next.js, Pages Router).
#
# Built from the repository root so the npm workspace lockfile is available:
#   docker build -f frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://example.com/api -t connectsocial-web .

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Manifests first, so dependency installation is cached independently of source.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY frontend ./frontend

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so the
# public API URL must be supplied here — changing the domain later requires
# rebuilding this image (docker compose up -d --build web).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm --workspace frontend run build

# ---------------------------------------------------------------------------
# Runtime stage: `next start` needs the production dependencies, the build
# output, the public folder and next.config.js (security headers live there).
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/frontend/next.config.js ./frontend/next.config.js

WORKDIR /app/frontend
USER node
EXPOSE 3000

CMD ["/app/node_modules/.bin/next", "start"]
