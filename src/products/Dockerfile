FROM node AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/
COPY src/products/package.json ./src/products/
RUN npm ci
COPY packages/kafka-common ./packages/kafka-common/
COPY src/products ./src/products/
RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=products

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/src/products/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4094
CMD ["node", "dist/server.js"]