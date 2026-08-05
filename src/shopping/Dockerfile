FROM node:22-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY src/shopping/package.json ./src/shopping/package.json

RUN npm ci 

COPY packages/kafka-common ./packages/kafka-common
COPY src/shopping ./src/shopping

RUN npx prisma generate --schema=./src/shopping/prisma/schema.prisma
RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=shopping

FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY src/shopping/package.json ./src/shopping/package.json

RUN npm ci --omit=dev


COPY --from=builder /app/packages/kafka-common/dist ./packages/kafka-common/dist
COPY --from=builder /app/src/shopping/dist ./dist
COPY --from=builder /app/src/shopping/prisma ./prisma

COPY --from=builder /app/src/shopping/src/grpc/products.proto ./src/grpc/products.proto
COPY --from=builder /app/src/shopping/src/grpc/shopping.proto ./src/grpc/shopping.proto

EXPOSE 4095
CMD ["node", "dist/server.js"]