# ---- Build stage ----
FROM node:20-slim AS builder
WORKDIR /app

# API base URL is inlined at build time (NEXT_PUBLIC_*)
ARG NEXT_PUBLIC_API_URL=http://localhost:5000/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY apps/web/package*.json ./
RUN npm install

COPY apps/web/ ./
RUN npm run build
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Asia/Jakarta

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["npm", "run", "start"]
