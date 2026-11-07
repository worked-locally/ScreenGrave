# syntax=docker/dockerfile:1

# ---------- build: the web app and a single-file server ----------
# Runs once on the build machine's own platform: the result is plain JavaScript that works everywhere.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- runtime: just Node, the built app, and the bundled server ----------
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/app/data/screengrave.db
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/LICENSE ./LICENSE

# the database lives here; mount a volume on it so your data survives updates
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]

USER node
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist-server/index.mjs"]
