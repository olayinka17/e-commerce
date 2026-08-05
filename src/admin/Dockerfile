FROM node:22-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY src/admin/package.json ./src/admin/package.json

RUN npm ci

COPY packages/kafka-common ./packages/kafka-common
COPY src/admin ./src/admin

RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=admin

FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY src/admin/package.json ./src/admin/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/packages/kafka-common/dist ./packages/kafka-common/dist
COPY --from=builder /app/src/admin/dist ./dist

COPY --from=builder /app/src/admin/src/grpc/inventory.proto ./src/grpc/inventory.proto
COPY --from=builder /app/src/admin/src/grpc/product.proto ./src/grpc/product.proto
COPY --from=builder /app/src/admin/src/grpc/shopping.proto ./src/grpc/shopping.proto

EXPOSE 4092
CMD ["node", "dist/server.js"]