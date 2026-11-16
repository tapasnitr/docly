# Docly - AI Document Processing & Collaboration SaaS

A production-style SaaS platform for document processing and AI-powered document Q&A.

## Project Structure

```
docly/
├── apps/
│   ├── web/       # Next.js frontend (App Router)
│   ├── api/       # Fastify REST API (controllers/services/repositories)
│   └── worker/    # Background job worker (BullMQ)
├── packages/
│   ├── database/  # Prisma ORM and schema
│   ├── config/    # Zod-validated environment configuration
│   ├── types/     # Shared TypeScript types + API response conventions
│   ├── logger/    # Structured logging (pino)
│   ├── redis/     # Redis client abstraction
│   └── ui/        # Shared React UI components (Tailwind)
├── infra/
│   ├── docker/    # Dockerfiles
│   └── nginx/     # Nginx reverse proxy config
├── docs/
│   ├── ARCHITECTURE.md   # API conventions, versioning, logging, validation
│   └── DEVELOPMENT.md    # Local setup, common tasks, troubleshooting
└── docker-compose.yml  # Local development setup
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for API/error/logging/validation conventions
and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for a detailed local setup guide.

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Fastify, Node.js, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with BullMQ
- **Background Jobs**: Worker process with BullMQ
- **Containerization**: Docker & Docker Compose
- **Monorepo**: Turbo

## Quick Start

### Prerequisites

- Node.js >= 20
- npm >= 10 (this repo uses npm workspaces, not pnpm/yarn)
- Docker Desktop, running (on Windows, Docker Desktop requires a WSL2 distro -
  if `docker-compose` hangs or fails with a `dockerDesktopLinuxEngine` error,
  see [Troubleshooting](docs/DEVELOPMENT.md#troubleshooting))

### Setup

1. Clone the repository and navigate into it.

2. Copy environment configuration:

```bash
cp .env.example .env
```

3. Install dependencies:

```bash
npm install
```

4. Start **just** the datastores in Docker (not the whole app):

```bash
docker-compose up -d postgres redis
```

5. Run database migrations:

```bash
npm run db:migrate
```

6. (Optional) Seed a demo organization with sample projects, members, and
   documents - useful for trying the app without registering:

```bash
npm run db:seed
```

7. Start the app (web, API, and worker, all in dev mode):

```bash
npm run dev
```

Leave that terminal running - it's a long-lived process, not something that exits.

Access the application:
- Frontend: http://localhost:3000
- API: http://localhost:3001/api/v1/health/ready

### Demo account

After running `npm run db:seed`, a public, read-only account is available -
click **View Demo** on the landing page/login page, or sign in manually with:

```
demo@docly.dev / DemoAccess123
```

This account is `VIEWER` everywhere (organization and every project), so it
can browse the whole app but can't create, edit, or delete anything - safe to
share the credentials publicly. Source of truth for the seed data is
[packages/database/seed.ts](packages/database/seed.ts); the credentials
themselves also live in
[apps/web/src/lib/demo.ts](apps/web/src/lib/demo.ts), which the "View Demo"
button uses - keep both in sync if you ever change them.

> **Alternative**: to run everything (including the frontend/API/worker)
> inside Docker instead of locally, use `docker-compose up -d` (no service
> names) and access it through nginx at http://localhost. Don't run both
> flows at once - they'd fight over the same ports. See
> [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for details.

**If `npm run dev` fails immediately or a page won't load:** the most common
cause is a port already in use (3000 or 3001) from a previous `npm run dev`
that's still running in another terminal - stop that one first. See
[docs/DEVELOPMENT.md#troubleshooting](docs/DEVELOPMENT.md#troubleshooting)
for this and other common setup issues.

## Ask your documents (RAG)

Open a project, upload a PDF/DOCX, wait for **Ready**, then click **Ask**.

- Answers stream in over Server-Sent Events with `[n]` citation chips and an expandable list of the source passages.
- Pipeline: extract -> chunk -> embed (worker) -> cosine search over the document's chunks -> grounded prompt (with a prompt-injection guard) -> streamed answer.
- Works with no API keys: embeddings fall back to an offline feature-hash and answers to extractive passages. Set `OPENAI_API_KEY` for real embeddings and `ANTHROPIC_API_KEY` for generated answers (see `.env.example`).
- Code: `packages/rag` (provider-agnostic core, unit-tested), `apps/api/src/services/ai.service.ts`, `apps/web/src/components/documents/AskPanel.tsx`.

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Next.js | 3000 | Frontend application |
| Fastify API | 3001 | REST API backend |
| PostgreSQL | 5432 | Main database |
| Redis | 6379 | Cache and queue |
| Nginx | 80 | Reverse proxy |
| Worker | - | Background jobs |

## Architecture

The application follows a **modular monolith + separate worker** architecture:

- **API**: Handles HTTP requests, business logic, and data persistence
- **Worker**: Processes background jobs from Redis queues
- **Shared Code**: Database, config, types, and logging shared across apps

This allows us to scale each component independently while maintaining a simple, unified codebase.

## Development Workflow

### Start development mode

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Database operations

```bash
# Run migrations
npm run db:migrate

# Push schema changes
npm run db:push

# Open Prisma Studio UI
npm run db:studio
```

### Docker commands

```bash
# Start just the datastores (the usual local-dev flow, paired with `npm run dev`)
docker-compose up -d postgres redis

# Or start everything, including the app itself, containerized
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Milestones

This project is built milestone by milestone. ✅ = implemented and wired up,
🚧 = scaffolded (schema/plumbing exists) but not functionally complete, no
mark = not started yet:

0. ✅ **Project Foundation** - Repository structure, Docker, config
1. ✅ **Database** - Prisma schema covering auth, organizations, projects, and documents
2. ✅ **Authentication** - Registration, login, JWT access/refresh tokens, email verification, password reset
3. ✅ **Organizations + RBAC** - Multi-tenancy, organization roles (OWNER/ADMIN/MEMBER/VIEWER)
4. ✅ **Project Management** - Projects, project-level roles (LEAD/MEMBER/VIEWER), members, dashboard, activity/audit log
5. **Document Management** - Upload, S3, metadata (`Document` model exists; no upload endpoint yet)
6. 🚧 **Background Processing** - BullMQ queue and worker service exist; the job handler is still a stub with nothing enqueuing real work
7. **RAG / AI** - Embeddings, vector search, LLM (schema modeled - `AiConversation`/`AiMessage`/`DocumentChunk` - no LLM integration yet)
8. **WebSockets** - Real-time updates (not started)
9. 🚧 **Production Hardening** - Rate limiting and structured error handling are live; caching and broader hardening still pending
10. 🚧 **Testing** - Integration tests cover auth, organizations, and dashboard (`apps/api/src/tests/`); projects and later features aren't covered yet
11. **CI/CD** - GitHub Actions pipelines (not started)
12. **AWS Deployment** - ECS, RDS, S3, CloudWatch (not started)

## Production Readiness

Milestone 0 establishes a production-ready foundation with:

- ✅ Proper monorepo structure
- ✅ TypeScript strict mode
- ✅ Docker containerization
- ✅ Health check endpoints
- ✅ Structured logging
- ✅ Environment configuration
- ✅ Graceful shutdown handling
- ✅ Error handling patterns
- ✅ Connection pooling ready (Prisma)

## Interview Questions - Milestone 0

**When discussing Milestone 0, be ready to explain:**

1. **Why monolith + worker instead of microservices initially?**
   - Simpler operational complexity
   - Easier debugging and local development
   - Ability to scale independently later
   - Can evolve into services gradually

2. **Why Fastify over Express?**
   - Performance: 2-3x faster
   - Modern: built for async/await
   - Validation: schema validation built-in
   - Lighter: smaller memory footprint

3. **Why Docker Compose for local dev?**
   - Mimics production architecture
   - Consistent development environment
   - Easy service management
   - Health checks and dependencies

4. **Redis placement - why separate?**
   - Clear separation of concerns
   - Can scale independently
   - Can failover independently
   - Easier to monitor

## Contributing

This is an educational project. Contributions and feedback are welcome!

## License

MIT
