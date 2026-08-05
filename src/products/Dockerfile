FROM node:22-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY src/products/package.json ./src/products/package.json

RUN npm ci

COPY packages/kafka-common ./packages/kafka-common/
COPY src/products ./src/products/

RUN npx prisma generate --schema=./src/products/prisma/schema.prisma
RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=products

FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY src/products/package.json ./src/products/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/packages/kafka-common/dist ./packages/kafka-common/dist
COPY --from=builder /app/src/products/dist ./dist
COPY --from=builder /app/src/products/prisma ./prisma

COPY --from=builder /app/src/products/src/grpc/products.proto ./src/products.proto

EXPOSE 4094
CMD ["node", "dist/server.js"]