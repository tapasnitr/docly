# Web Dockerfile for Next.js
FROM node:20-alpine AS base

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci

# Next's own bundler resolves and transpiles workspace packages (see
# transpilePackages in next.config.ts), so no separate package build is
# needed here - `next build` produces a fully self-contained .next/ output.
RUN npm run build --workspace=@docly/web

# Runtime stage
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci --omit=dev

COPY --from=base /app/apps/web/.next ./apps/web/.next

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=@docly/web"]
