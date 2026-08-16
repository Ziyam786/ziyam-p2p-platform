# Multi-stage production build
FROM node:20-alpine AS builder
# Alpine ships no openssl binary by default, so Prisma's own runtime platform
# detection can't see OpenSSL 3.x is present and silently assumes 1.1.x,
# picking the wrong query-engine binary even when the right one exists in
# node_modules — installing openssl here fixes detection at generate time.
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000
CMD ["node", "dist/backend/server.js"]
