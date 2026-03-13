FROM node:22-slim AS build

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build SPA (standalone mode — no Cloudflare plugin)
RUN npm run build:standalone

# ---

FROM node:22-slim AS runtime

WORKDIR /app

# Copy built SPA
COPY --from=build /app/dist/standalone ./dist/standalone

# Copy server source (executed via tsx at runtime)
COPY --from=build /app/server ./server
COPY --from=build /app/worker ./worker

# Copy migrations
COPY --from=build /app/drizzle ./drizzle

# Copy package files and install production deps + tsx
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npm install tsx

EXPOSE 3000

ENV PORT=3000
ENV DATABASE_PATH=/data/rackifai.db

VOLUME /data

CMD ["node", "--import", "tsx", "server/index.ts"]
