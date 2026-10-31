# syntax=docker/dockerfile:1

# ---------- build: compile the web app ----------
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- runtime: only what the server needs ----------
FROM node:24-slim
ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/app/data/screengrave.db
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist

# the database lives here; mount a volume on it so your data survives updates
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]

USER node
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "tsx", "server/index.ts"]
