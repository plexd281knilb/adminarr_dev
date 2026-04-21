# Use a specific node version for stability
FROM node:22-alpine AS base

# Install OpenSSL (Required by Prisma on Alpine) and libc6-compat
RUN apk add --no-cache libc6-compat openssl

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
    
# 1. Copy package files
COPY package.json package-lock.json* ./

# 2. Copy the Prisma schema and the new Prisma 7 config
COPY prisma ./prisma/
COPY prisma.config.ts ./
    
# 3. NOW run the install (which will trigger prisma generate successfully)
RUN npm install

# Rebuild the source code only when necessary
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# CRITICAL FIX: Bypass self-signed SSL cert errors during build, and create 
# a dummy data folder so Next.js doesn't panic during static pre-rendering.
ENV NODE_TLS_REJECT_UNAUTHORIZED="0"
RUN mkdir -p /app/data

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/dev.db"
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# CRITICAL FIX: Tell Node to permanently trust Unraid's self-signed certificates
ENV NODE_TLS_REJECT_UNAUTHORIZED="0"

# Create the data directory for the live container
RUN mkdir -p /app/data

COPY --from=builder /app/public ./public
# Automatically leverage output traces to reduce image size
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Copy Prisma schema and config
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

# CRITICAL FIX: Copy node_modules so the startup CMD has access to Prisma CLI
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3000

# Run migrations, seed the initial admin/settings, and start the Next.js server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx tsx prisma/seed.ts && node server.js"]