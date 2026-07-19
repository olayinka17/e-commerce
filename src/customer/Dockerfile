# FROM node as build
# WORKDIR /src/customer
# COPY package.json package-lock.json ./
# RUN npm ci
# COPY . .
# RUN npm run build

# FROM node:22-alpine AS runtime
# WORKDIR /app
# COPY --from=build /src/customer/dist /app
# EXPOSE 4093
# CMD ["node", "dist/server.js"]

FROM node AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/kafka-common/package.json ./packages/kafka-common/
COPY src/customer/package.json ./src/customer/
RUN npm ci
COPY packages/kafka-common ./packages/kafka-common/
COPY src/customer ./src/customer/
RUN npm run build --workspace=@enterprise/kafka-common
RUN npm run build --workspace=customer


FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/src/customer/dist ./dist/
COPY --from=builder /app/node_modules ./node_modules/
EXPOSE 4093
CMD ["node", "dist/server.js"]