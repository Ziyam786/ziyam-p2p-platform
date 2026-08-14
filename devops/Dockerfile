# Multi-stage production build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm run frontend:build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# Next.js standalone output (if configured) or standard build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# We will run both backend and frontend processes using a simple script or just exposing both ports
EXPOSE 5000
EXPOSE 3000

# Start both backend and frontend in the background
CMD ["sh", "-c", "node dist/backend/server.js & npm run frontend:start"]
