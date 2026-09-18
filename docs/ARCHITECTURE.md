# Architecture

This document defines the conventions established in the project foundation
milestone. Every future feature should follow these unless there's a
documented reason not to.

## API layering (`apps/api`)

Requests flow through four layers, each with a single responsibility:

```
routes/v1/*.routes.ts   → registers endpoints under a version prefix
controllers/*.ts        → parses the request, calls a service, shapes the response
services/*.ts           → business logic, orchestrates repositories
repositories/*.ts       → the only place raw Prisma/Redis calls happen
```

`routes/v1/health.routes.ts` → `controllers/health.controller.ts` →
`services/health.service.ts` → `repositories/health.repository.ts` is the
reference implementation - new domains (auth, documents, ...) should follow
the same shape.

App construction (`app.ts`, plugins, middleware, routes) is kept separate
from starting the HTTP listener (`index.ts`), so the app can be built and
exercised without binding a port (useful for tests later).

## API response conventions

Every response is one of two shapes (`@docly/types`):

```ts
// success
{ success: true, data: T, meta?: {...}, timestamp: string }

// error
{ success: false, error: { code: string, message: string, details?: unknown }, timestamp: string }
```

Controllers call `sendSuccess(reply, data, statusCode?, meta?)` from
`apps/api/src/lib/api-response.ts` rather than `reply.send()` directly, so
the envelope shape can't drift between endpoints.

## Error handling

`apps/api/src/lib/errors.ts` defines an `AppError` base class and typed
subclasses (`BadRequestError`, `ValidationError`, `UnauthorizedError`,
`ForbiddenError`, `NotFoundError`, `ConflictError`, `ServiceUnavailableError`),
each with a fixed `statusCode` and `code`. Throw these anywhere in a
controller/service/repository - a single central handler
(`apps/api/src/middleware/error-handler.ts`) catches them and produces the
standard error envelope.

Anything that is *not* an `AppError` (an unexpected exception, a database
driver error, etc.) is logged with full detail and returns a generic
`Internal Server Error` message in production (the real message is included
in development, to help debugging without leaking internals to clients).

## Validation strategy

Request input (body/params/query) is validated with [Zod](https://zod.dev).
`apps/api/src/middleware/validate.ts` exposes `parseWithSchema(schema, data)`,
which throws a `ValidationError` (→ 400 with field-level details) on failure.
Schemas live next to the controller/route that uses them - there's no global
schema registry to keep in sync.

Environment configuration is validated the same way: `packages/config`
parses `process.env` through a Zod schema once at import time, so a
misconfigured deployment fails immediately on startup with a readable error
instead of an obscure runtime failure later. Rules can differ by
environment - e.g. `JWT_SECRET` must be at least 32 characters in
production, but falls back to a dev-only default locally.

## API versioning strategy

Routes are grouped by version under `apps/api/src/routes/v1/` and registered
with the `/api/v1` prefix (`routes/v1/index.ts`). A breaking change gets a
new `routes/v2/` module registered *alongside* v1 (not a mutation of v1's
contract), so existing clients keep working against `/api/v1` while new
clients move to `/api/v2`.

## Logging strategy

`packages/logger` wraps `pino`. Logs are structured JSON everywhere; when
`NODE_ENV !== 'production'` they're additionally pretty-printed for local
readability. This follows `NODE_ENV` rather than a separate flag, so there's
one less thing to misconfigure at deploy time. Every app (`api`, `worker`)
creates its logger via `createLogger(name, level)` rather than instantiating
`pino` directly, so the behavior stays consistent.

Fastify is configured with a random UUID `genReqId`, so every log line for a
request (including ones emitted by the error handler) can be correlated by
request ID.

## Redis abstraction (`packages/redis`)

`packages/redis` exposes `connectRedis()`, `getRedisClient()`, and
`disconnectRedis()`. Unlike the previous approach, connecting is **not** a
side effect of importing the package - the API explicitly calls
`connectRedis()` during startup (`apps/api/src/plugins/redis.ts`) before it
starts accepting traffic, and disconnects on shutdown via Fastify's
`onClose` hook. Calling `getRedisClient()` before `connectRedis()` throws
immediately instead of silently operating on a dead client.

BullMQ (`apps/worker`) manages its own Redis connection separately - it
needs an ioredis-style `{ host, port }` object, not a client instance, so it
derives that from `REDIS_URL` directly rather than going through
`packages/redis`.

## Frontend structure (`apps/web`)

- Tailwind CSS (`tailwind.config.ts`, `globals.css`) with shared components
  from `@docly/ui` (`packages/ui`) - `Button`, `Card`, `Input`, `Badge`.
- Route groups: `(marketing)` for public pages, `(app)` for the
  authenticated area. Groups don't affect the URL - they exist to give each
  area its own layout.
- `src/middleware.ts` matches `/dashboard/:path*` and currently passes every
  request through. It's the integration point for session verification once
  authentication exists (see the `TODO(auth)` comments in `middleware.ts`
  and `(app)/layout.tsx`) - deliberately not implemented yet, per the
  current milestone's scope.
- `src/lib/api-client.ts` is a typed `fetch` wrapper that speaks the API's
  response envelope directly, so callers get typed data or a typed
  `ApiRequestError`, never a raw `Response` to unwrap by hand.

## Multi-tenant / production-readiness notes for future features

These aren't implemented yet (no business features exist), but the
foundation is built to support them:

- CORS origin is configurable via `CORS_ORIGIN` (comma-separated list, or
  `*` for local dev) rather than hardcoded to allow-all.
- Prisma models (`packages/database/prisma/schema.prisma`) already carry an
  `organizationId` on every tenant-owned table with an index - future
  repositories must filter every query by the authenticated user's
  organization.
- `AuditLog` model exists for the future audit-logging feature.
