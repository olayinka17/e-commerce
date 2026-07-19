# FROM node AS build
# WORKDIR /src/inventory
# COPY package.json package-lock.json ./
# RUN npm ci
# COPY . .
# RUN npm run build

# FROM node:22-alpine AS runtime
# WORKDIR /app
# COPY --from=build /src/inventory/dist /app
# EXPOSE 40100
# CMD ["node", "dist/server.js"]

FROM node AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/
COPY src/inventory/package.json ./src/inventory/
RUN npm ci
COPY packages/kafka-common ./packages/kafka-common/
COPY src/inventory ./src/inventory/
RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=inventory

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/src/inventory/dist ./dist/
COPY --from=builder /app/node_modules ./node_modules/
EXPOSE 40100
CMD ["node", "dist/server.js"]