FROM node AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/
COPY src/orchestrator/package.json ./src/orchestrator/
RUN npm ci
COPY packages/kafka-common ./packages/kafka-common/
COPY src/orchestrator ./src/orchestrator/
RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=orchestrator

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/src/orchestrator/dist ./dist/
COPY --from=builder /app/node_modules ./node_modules/

CMD ["node", "dist/bootstrap.js"]
