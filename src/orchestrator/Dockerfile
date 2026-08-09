FROM node:22-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY src/orchestrator/package.json ./src/orchestrator/package.json

RUN npm ci

COPY packages/kafka-common ./packages/kafka-common
COPY src/orchestrator ./src/orchestrator


RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=orchestrator

FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/packages/kafka-common/package.json ./packages/kafka-common/package.json
COPY --from=builder /app/packages/kafka-common/dist ./packages/kafka-common/dist

COPY --from=builder /app/src/orchestrator/dist ./dist

CMD ["node", "dist/index.js"]
