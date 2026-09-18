# API Dockerfile for Fastify
FROM node:20-alpine AS base

WORKDIR /app

# npm workspaces needs every workspace's package.json present to resolve the
# lockfile correctly, so copy the whole monorepo rather than just this app.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci

# Type-checks and produces a build - fails the image build on compile errors.
RUN npm run build --workspace=@docly/api

# Runtime stage
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci --omit=dev

EXPOSE 3001

# Runs via tsx (a production dependency here) rather than the tsc-compiled
# dist/, because workspace packages (@docly/database, @docly/config, ...) are
# consumed as TypeScript source - the same way they run in development - not
# as a separately built artifact.
CMD ["npm", "run", "start", "--workspace=@docly/api"]
