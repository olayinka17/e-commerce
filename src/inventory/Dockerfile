FROM node:22-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY src/inventory/package.json ./src/inventory/package.json

RUN npm ci

COPY packages/kafka-common ./packages/kafka-common
COPY src/inventory ./src/inventory

RUN npx prisma generate --schema=./src/inventory/prisma/schema.prisma
RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=inventory

FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl

# COPY  package.json package-lock.json ./
# COPY packages/kafka-common/package.json ./packages/kafka-common/package.json
# COPY src/inventory/package.json ./src/inventory/package.json

# RUN npm ci --omit=dev

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY --from=builder /app/packages/kafka-common/dist ./packages/kafka-common/dist

COPY --from=builder /app/src/inventory/dist ./dist/
COPY --from=builder /app/src/inventory/prisma ./prisma

COPY --from=builder /app/src/inventory/src/inventory.proto ./inventory.proto

EXPOSE 40100
CMD ["node", "dist/index.js"]