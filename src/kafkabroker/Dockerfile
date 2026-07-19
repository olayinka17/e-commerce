# FROM node
# WORKDIR /app
# COPY package.json tsconfig.json ./
# RUN npm install

# COPY . .

# CMD ["node", "dist/admin.js"]

# FROM node AS base
# WORKDIR /app

# FROM base AS builder
# COPY package.json package-lock.json ./
# COPY packages/kafka-common/package.json ./package/kafka-common
# COPY src/admin/package.json ./src/admin
# RUN npm ci
# COPY packages/kafka-common ./packages/kafka-common
# COPY src/admin ./src/admin
# RUN npm run build --workspace=@enterprise/kafka-common
# RUN npm run build --workspace=admin

# FROM node:22-alpine
# WORKDIR /app
# COPY --from=builder /app/src/admin/dist .
# COPY --from=builder /app/node_modules ./node_modules
# EXPOSE 4092
# CMD ["node", "dist/server.js"]

FROM node AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/
COPY src/kafkabroker/package.json ./src/kafkabroker/
RUN npm ci
COPY packages/kafka-common ./packages/kafka-common/
COPY src/kafkabroker ./src/kafkabroker/
RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=kafkabroker

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/src/kafkabroker/dist ./dist/
COPY --from=builder /app/node_modules ./node_modules/
CMD ["node", "dist/admin.js"]

