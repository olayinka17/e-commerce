FROM node AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/
COPY src/shopping/package.json ./src/shopping/
RUN npm ci
COPY packages/kafka-common ./packages/kafka-common/
COPY src/shopping ./src/shopping/
RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=shopping

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/src/shopping/dist ./dist/
COPY --from=builder /app/node_modules ./node_modules/
EXPOSE 4095
CMD ["node", "dist/server.js"]