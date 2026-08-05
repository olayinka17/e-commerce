FROM node:22-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY src/customer/package.json ./src/customer/package.json

RUN npm ci

COPY packages/kafka-common ./packages/kafka-common
COPY src/customer ./src/customer

RUN npx prisma generate --schema=./src/customer/prisma/schema.prisma
RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=customer


FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY src/customer/package.json ./src/customer/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/packages/kafka-common/dist ./packages/kafka-common/dist
COPY --from=builder /app/src/customer/dist ./dist
COPY --from=builder /app/src/customer/prisma ./prisma


EXPOSE 4093
CMD ["node", "dist/server.js"]