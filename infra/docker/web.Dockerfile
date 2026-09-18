# Web Dockerfile for Next.js
FROM node:20-alpine AS base

WORKDIR /app

# Copy monorepo files
COPY package.json pnpm-lock.yaml ./
COPY apps/web ./apps/web
COPY packages ./packages
COPY tsconfig.base.json ./

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Build Next.js
RUN pnpm -F @docly/web build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/web ./apps/web
COPY packages ./packages

RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000

CMD ["pnpm", "-F", "@docly/web", "start"]
