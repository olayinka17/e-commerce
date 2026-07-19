# FROM node AS build
# WORKDIR /src/admin
# COPY package.json package-lock.json ./
# RUN npm ci
# COPY . .
# RUN npm run build

# FROM node:22-alpine AS runtime
# WORKDIR /app
# COPY --from=build /src/admin/dist /app
# EXPOSE 4092

# CMD ["node", "dist/server.js"]

FROM node AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/
COPY src/admin/package.json ./src/admin/
RUN npm ci
COPY packages/kafka-common ./packages/kafka-common/
COPY src/admin ./src/admin/
RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=admin

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/src/admin/dist ./dist/
COPY --from=builder /app/node_modules ./node_modules/
EXPOSE 4092
CMD ["node", "dist/server.js"]