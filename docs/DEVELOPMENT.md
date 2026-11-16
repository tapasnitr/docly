# Development Setup

## Prerequisites

- Node.js >= 20
- npm >= 10 (this repo uses npm workspaces - not pnpm/yarn)
- Docker & Docker Compose

## First-time setup

```bash
cp .env.example .env
npm install
docker-compose up -d postgres redis   # start just the datastores for local dev
npm run db:migrate                    # applies the Prisma schema
npm run dev                           # starts web (3000), api (3001), worker
```

Then visit http://localhost:3000 (web) and http://localhost:3001/api/v1/health/ready (api).

All three (`web`, `api`, `worker`) auto-restart on their own - no manual
restarts needed for a normal edit-save-reload loop:
- `api`/`worker` run via `tsx watch`, which restarts on any source file
  change **and** on a change to the root `.env` (via `--include ../../.env`).
- `web` runs via `nodemon` wrapping `next dev` (see `apps/web/nodemon.json`),
  which restarts only on a change to the root `.env` or `next.config.ts` -
  regular page/component edits are left to Next's own Fast Refresh, which is
  faster and preserves component state, so nodemon deliberately stays out of
  its way.

If you'd rather run everything (including api/web/worker) inside Docker, use
`docker-compose up -d` instead and access through nginx at http://localhost.

## Common tasks

```bash
npm run dev          # all apps in dev mode, in parallel (turbo)
npm run build        # production build of every app
npm run lint          # eslint across every app
npm run type-check    # tsc --noEmit across every workspace
npm run test          # vitest across every workspace that has tests (currently api, web)

npm run db:migrate    # prisma migrate dev
npm run db:push       # prisma db push (no migration file)
npm run db:studio     # Prisma Studio UI
npm run db:seed       # seed a demo organization + read-only demo login (see README's "Demo account")
```

Each of these can also be scoped to a single workspace, e.g.
`npm run type-check --workspace=@docly/api`.

`@docly/api`'s tests (`npm run test --workspace=@docly/api`) are integration
tests that exercise the real auth, organizations/RBAC, and dashboard stack via
Fastify's `app.inject()` - no mocking, but that means they need
`docker-compose up -d postgres redis` running and a valid `.env`
(`cp .env.example .env` is enough for local dev).

## Environment variables

See `.env.example` for the full list. `packages/config` loads the repo-root
`.env` (if present) before reading `process.env`, so `cp .env.example .env`
is enough for `npm run dev`/`npm run test` run outside Docker - no extra
tooling needed. Everything is then read and validated through a Zod schema -
if a required variable is missing or malformed, the API/worker will fail to
start with a readable error instead of failing confusingly later.

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | api, worker | Postgres connection string |
| `REDIS_URL` | api, worker | Redis connection string (worker derives host/port from this for BullMQ) |
| `API_HOST` / `API_PORT` | api | |
| `CORS_ORIGIN` | api | Comma-separated allowed origins, or `*` for local dev |
| `NEXT_PUBLIC_API_URL` | web | Base URL the browser uses to call the API |
| `WORKER_CONCURRENCY` | worker | BullMQ concurrent job count |
| `JWT_SECRET` / `JWT_EXPIRY` / `JWT_REFRESH_EXPIRY` | api | Required (min 32 chars) in production; used to sign/expire access + refresh tokens (`/api/v1/auth/*`) |
| `LOG_LEVEL` | api, worker | pino log level |
| `AWS_*`, `OPENAI_API_KEY` | (future) | Placeholders for document storage / AI features, not wired up yet |

## Troubleshooting

**`npm install` fails with `EISDIR` on a symlink, or workspace packages
don't resolve.** npm workspaces link local packages into `node_modules`
using directory junctions, which require a real NTFS (or Linux ext4)
filesystem. This breaks on FAT32/exFAT drives (common on external/portable
drives) and on some network shares. Move the project to an NTFS/ext4 volume.

**Docker Desktop won't start on Windows (`request returned 500 Internal
Server Error ... dockerDesktopLinuxEngine`).** Docker Desktop's default
backend needs a WSL2 Linux distribution installed. Check with
`wsl --status` - if it reports no installed distributions, run
`wsl --install -d Ubuntu` from an elevated PowerShell/Terminal, reboot if
prompted, then restart Docker Desktop.

**`prisma migrate dev` can't reach the database.** Confirm
`docker-compose ps` shows `postgres` as healthy, and that `DATABASE_URL` in
your `.env` matches the credentials in `docker-compose.yml`.

**`npm run dev` fails immediately, or `localhost:3000`/`localhost:3001`
doesn't load what you expect.** Almost always a previous `npm run dev` is
still running in another terminal (or background process) and already
holding those ports. Find and stop it before starting a new one - on
Windows, `netstat -ano | findstr :3000` (or `:3001`) prints the PID holding
the port, which you can then stop with `taskkill /PID <pid> /F`; on
macOS/Linux, `lsof -i :3000` does the same, stopped with `kill <pid>`. Also
make sure you're not running the hybrid flow (`npm run dev`) and the fully
dockerized flow (`docker-compose up -d` with no service names) at the same
time - both bind the same ports.

**Login/register succeeds but every page under `(app)/` (dashboard,
organizations, ...) 500s or bounces back to `/login`.** Check the web dev
server's terminal for `TypeError: fetch failed` coming from
`lib/session.ts`. This means `API_INTERNAL_URL` in `.env` is missing or
uses `localhost` instead of `127.0.0.1` - Node's server-side `fetch` (used
by `getCurrentUser()` on every `(app)/` page) resolves `localhost` to the
IPv6 loopback first, but the API only binds IPv4, so the request fails even
though the exact same URL works fine from a browser or `curl`. Fix `.env`'s
`API_INTERNAL_URL` to use `127.0.0.1`, then restart `npm run dev`.

**Login succeeds (no error shown) but the app never navigates to
`/dashboard`, or bounces back to `/login` right after.** `NEXT_PUBLIC_API_URL`
in `.env` is pointed at `127.0.0.1` instead of `localhost`. Cookies are
scoped by hostname, not port - if the browser's login request goes to
`127.0.0.1:3001`, the session cookies it gets back are stored under
`127.0.0.1` and never sent back to this app's own `localhost:3000` origin,
so the next page's server-side session check finds no cookies and treats
you as logged out. `NEXT_PUBLIC_API_URL` must always match the hostname the
web app itself is served from (`localhost`); use the separate
`API_INTERNAL_URL` (see above) for the IPv4 workaround instead - never
point `NEXT_PUBLIC_API_URL` at `127.0.0.1`.
