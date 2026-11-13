# ---- Stage 1: build the React client (Vite) ---------------------------------------------------
FROM node:24-alpine AS client-builder
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
# deploy.yml passes --build-arg GIT_SHA=<full commit SHA>; the footer shows its first 7 characters (R-08).
ARG GIT_SHA=local
RUN VITE_GIT_SHA="$GIT_SHA" npm run build

# ---- Stage 2: server dependencies + Prisma client for this platform (Alpine, musl, OpenSSL 3) ---
FROM node:24-alpine AS server-builder
WORKDIR /app/server
RUN apk add --no-cache openssl
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate && npx prisma version && npm prune --omit=dev

# ---- Stage 3: runtime --------------------------------------------------------------------------
FROM node:24-alpine AS production
WORKDIR /app/server
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    TZ=Asia/Bangkok \
    PORT=3000
COPY --from=server-builder /app/server ./
# server/src/app.ts serves ../../client/dist relative to itself, so the layout mirrors the repository.
COPY --from=client-builder /app/client/dist /app/client/dist
RUN chmod +x ./docker-entrypoint.sh
# The same SHA for GET /api/version (config.ts checks it is a full SHA or "local").
ARG GIT_SHA=local
ENV GIT_SHA=$GIT_SHA
EXPOSE 3000
# Never run as root inside the container.
USER node
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "--import", "tsx", "src/index.ts"]
