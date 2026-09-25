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
- Route groups: `(marketing)` for public pages (including `/login` and
  `/register`), `(app)` for the authenticated area (`/dashboard`,
  `/organizations`, `/organizations/[organizationId]/settings`,
  `/organizations/[organizationId]/members`). Groups don't affect the URL -
  they exist to give each area its own layout.
- `components/organizations/OrganizationSwitcher.tsx` lives in the `(app)`
  header, so it's available from every protected page - it lists the
  organizations the signed-in user belongs to (via `lib/use-organizations.ts`)
  and highlights the one implied by the current URL, if any.
- `/dashboard` isn't organization-scoped by URL (unlike the `/organizations/[id]/...`
  routes), so `lib/use-current-organization.ts` tracks which one it's showing -
  the last one picked from the switcher (remembered in `localStorage`, a UX
  convenience only), falling back to the user's first organization. Every API
  call still re-verifies membership for whatever id is actually sent, same as
  always.
- `components/dashboard/` (`DashboardCard`, `StatTile`, `SectionState`) are
  the reusable building blocks every dashboard section is built from, so
  loading/empty/error handling (`SectionState`) can't drift between the
  documents/activity/storage/AI-usage cards. `lib/use-async.ts` is the
  matching data-fetching half - one hook, three independent call sites on
  `/dashboard`, so one section's fetch failing doesn't block the others.
- `src/middleware.ts` matches `/dashboard/:path*` and redirects to `/login`
  when there's no access-token cookie. This is a UX fast-path only, not the
  security boundary - it doesn't verify the token, just checks it's present.
- `(app)/layout.tsx` is the actual boundary: it's an async server component
  that calls the API's `/auth/me` (forwarding the request's cookies via
  `src/lib/session.ts`) and redirects to `/login` unless that comes back with
  a real user. Every protected page nests under it for free.
- `src/lib/auth-context.tsx` (`AuthProvider`/`useAuth`) holds client-side
  session state (`loading` / `authenticated` / `unauthenticated`) and the
  `login`/`register`/`logout` actions used by `components/auth/*`.
- `src/lib/api-client.ts` is a typed `fetch` wrapper that speaks the API's
  response envelope directly (and sends `credentials: 'include'` so the
  session cookies travel with it), so callers get typed data or a typed
  `ApiRequestError`, never a raw `Response` to unwrap by hand.

## Authentication (`apps/api/src/{controllers,services,repositories}/auth.*`)

- Registration/login return a short-lived JWT access token (`JWT_EXPIRY`,
  `@fastify/jwt`) and a long-lived opaque refresh token (`JWT_REFRESH_EXPIRY`),
  both set as httpOnly cookies (`docly_access_token` / `docly_refresh_token`,
  `apps/api/src/lib/cookies.ts`) - secure in production, `sameSite=lax`
  always. `@fastify/jwt`'s `cookie` option also lets non-browser clients
  authenticate via a plain `Authorization: Bearer` header.
- Refresh tokens are opaque random strings; only their SHA-256 digest is
  persisted (`RefreshToken.token`), so a database leak alone can't produce a
  usable session. `/auth/refresh` rotates on every use - revokes the
  presented token and issues a new one - so a replayed old refresh token is
  rejected.
- Passwords are hashed with bcrypt (`apps/api/src/lib/password.ts`, 12 salt
  rounds) and a Prisma `User` never crosses into a response body without
  going through `lib/sanitize-user.ts`, which drops `passwordHash`.
- Login failures (wrong password, unknown email) return the identical 401
  message and run `bcrypt.compare` against a dummy hash either way, so the
  response can't be used to enumerate which emails have accounts.
- `middleware/authenticate.ts` is a `preHandler` that verifies the JWT and
  populates `request.user` (typed via `types/fastify-jwt.d.ts`) with just
  `{ userId, iat, exp }` - deliberately no organization/role claim, see the
  Organizations section below for why. Attach it to any route that requires
  a signed-in user.

## Organizations & RBAC (`apps/api/src/{controllers,services,repositories}/organization*`)

- A user's relationship to an organization - whether they belong to it, and
  with what role - lives entirely in the `OrganizationMember` join table
  (`packages/database/prisma/schema.prisma`), not on `User`. One person can
  belong to several organizations with a different role in each, which is why
  `JwtPayload` (`@docly/types`) carries only `userId`: a role claim issued at
  login time would go stale the moment membership changes, and would need to
  pick one organization anyway.
- Roles, ascending: `VIEWER < MEMBER < ADMIN < OWNER` (`lib/rbac.ts`'s
  `roleAtLeast`). OWNER has full access, ADMIN manages organization
  resources/members, MEMBER works with permitted resources, VIEWER is
  read-only.
- `middleware/require-organization-role.ts` is the RBAC middleware and the
  **critical** tenant-isolation check: for every route nested under
  `/organizations/:organizationId`, it looks up a real `OrganizationMember`
  row for `(request.user.userId, :organizationId)` on every request - never
  trusting a role or organization id carried on the token, in the request
  body, or anywhere else the caller controls. If the organization doesn't
  exist *or* the caller isn't a member of it, it raises the same 404 either
  way, so probing organization ids can't be used to discover which ones
  exist. Chain it after `authenticate`:
  `{ preHandler: [authenticate, requireOrganizationRole('ADMIN')] }`.
- Nested member routes (`PATCH`/`DELETE .../members/:memberId`) additionally
  scope the `memberId` lookup to `:organizationId`
  (`organizationMemberRepository.findByIdInOrganization`), so a `memberId`
  that belongs to a different organization can never be reached by pointing
  the URL's `:organizationId` at an org the caller *does* belong to - this is
  what stops organization-id manipulation on those routes.
- Rules that depend on the *target* member (not just the actor's role) live
  in `organization-member.service.ts`, since they can't be expressed as a
  single minimum role: only an OWNER can grant or change OWNER-level
  membership; an organization always keeps at least one OWNER (the last one
  can't be demoted or removed); any member can always remove themselves
  (leave), regardless of role.
- Controllers never take `organizationId` from the request body for an
  organization-scoped route - always the URL param that
  `requireOrganizationRole()` already verified
  (`organization.controller.ts`'s `organizationId()` helper).
- Registering an account still provisions a personal `Organization` (an
  `OrganizationMember` row with role `OWNER`, in the same transaction as the
  `User` row - `repositories/auth.repository.ts`), same as before; it just
  goes through the same membership table as every other organization now.
- `Organization.plan` (`FREE`/`PRO`/`ENTERPRISE`) and `.status`
  (`ACTIVE`/`SUSPENDED`) are structural fields, not Owner/Admin-editable
  settings: they default at creation and are deliberately excluded from
  `updateOrganizationSchema` (`organization.controller.ts`), since real plan
  changes belong to a billing flow and status changes to ops/admin action -
  neither exists yet. A `PATCH` that includes `plan`/`status` silently drops
  them (unknown keys to that schema) rather than erroring.
- `Organization.logoUrl` and `.settings` (a `Json` column normalized through
  `lib/organization-settings.ts`'s `normalizeSettings()`/`applySettingsPatch()`)
  *are* Owner/Admin-editable via the same `PATCH /organizations/:organizationId`
  route, ADMIN minimum. `settings` covers default member role, member
  permissions, AI settings, and notification settings
  (`OrganizationSettings` in `@docly/types`); a `PATCH` sends a partial patch
  that's merged one level deep onto the organization's current settings, not
  a full replacement, so changing one setting can't clobber the rest. These
  settings are stored and returned but - like `OPENAI_API_KEY`/`AWS_*` - not
  yet enforced anywhere else in the app (no AI feature or document-retention
  job exists yet to read them).

## Dashboard, activity & usage (`apps/api/src/{controllers,services,repositories}/dashboard.*`, `activity.*`, `usage.*`)

- Three read-only, VIEWER-minimum endpoints under
  `/organizations/:organizationId/{dashboard,activity,usage}`
  (`routes/v1/dashboard.routes.ts`) - same `requireOrganizationRole()`
  tenant-isolation guarantee as every other organization-scoped route.
- No document-processing pipeline exists yet (a later feature), so document
  counts, storage usage, and AI usage are real aggregates
  (`repositories/dashboard.repository.ts`, Prisma `groupBy`/`aggregate` over
  `Document`/`AiConversation`/`AiMessage`) rather than anything mocked - they
  simply read as all-zero/empty until that pipeline starts writing rows.
  `Document.status` (`pending`/`processing`/`ready`/`failed`) is bucketed into
  the four the product asks for in `dashboard.service.ts`'s
  `toDocumentCounts()`: `processing` covers both `pending` and `processing`
  (neither has finished), `completed` is `ready`.
- The activity feed is the first real consumer of the `AuditLog` model. Since
  `AuditLog.userId` is a loose string, not a foreign key (by design, so a
  deleted user's history isn't cascaded away), `activity.service.ts` resolves
  actor names with a separate batch lookup
  (`userRepository.findSummariesByIds`) rather than a Prisma `include`.
- `auditLogRepository.record()` is called from `organization.service.ts`
  (`organization.created` / `.updated` / `.deleted`) and
  `organization-member.service.ts` (`member.added` / `.role_updated` /
  `.removed`) - any future domain that wants to show up in the activity feed
  calls it the same way. The delete path records *before* deleting, since
  `AuditLog` has no FK back to `Organization` and is meant to outlive the
  tenant it describes.

## Multi-tenant / production-readiness notes for future features

- CORS origin is configurable via `CORS_ORIGIN` (comma-separated list, or
  `*` for local dev) rather than hardcoded to allow-all.
- Prisma models (`packages/database/prisma/schema.prisma`) already carry an
  `organizationId` on every tenant-owned table with an index - future
  repositories for those resources (documents, etc.) must filter every query
  by `organizationId` and sit behind `requireOrganizationRole()`, the same
  way the organizations and dashboard domains do.
