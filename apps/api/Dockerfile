# ---- Build stage ----
FROM node:20-slim AS builder
WORKDIR /app

# OpenSSL is required by Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies for the API package (standalone)
COPY apps/api/package*.json ./
RUN npm install

# Copy source, generate Prisma client (emits TS into src/generated), build TS
COPY apps/api/ ./
RUN npx prisma generate
RUN npm run build        # tsc compiles src/ -> dist/ (incl. dist/generated/prisma)

# ---- Runtime stage ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Timezone: WIB so "today"/daily reports align with the local calendar
ENV TZ=Asia/Jakarta

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Needed by `prisma db seed` (ts-node prisma/seed.ts imports the generated client from src/)
COPY --from=builder /app/src/generated ./src/generated

EXPOSE 5000
# Apply pending migrations, then start the compiled server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
