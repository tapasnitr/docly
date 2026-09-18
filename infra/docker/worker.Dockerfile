# Worker Dockerfile
FROM node:20-alpine AS base

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci

RUN npm run build --workspace=@docly/worker

# Runtime stage
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci --omit=dev

CMD ["npm", "run", "start", "--workspace=@docly/worker"]
