# API Dockerfile for Fastify
FROM node:20-alpine AS base

WORKDIR /app

# Copy monorepo files
COPY package.json pnpm-lock.yaml ./
COPY apps/api ./apps/api
COPY packages ./packages
COPY tsconfig.base.json ./

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Build TypeScript
RUN pnpm -F @docly/api build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
