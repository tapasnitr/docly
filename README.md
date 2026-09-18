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
- npm >= 10
- Docker & Docker Compose

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

4. Start Docker services:

```bash
docker-compose up -d
```

5. Run database migrations:

```bash
npm run db:migrate
```

6. Start development servers:

```bash
npm run dev
```

Access the application:
- Frontend: http://localhost
- API: http://localhost/api
- API Swagger (later): http://localhost/api/docs

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
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Milestones

This project is built milestone by milestone:

0. ✅ **Project Foundation** - Repository structure, Docker, config
1. **Database** - Prisma setup, migrations, indexes
2. **Authentication** - Registration, login, JWT
3. **Organizations + RBAC** - Multi-tenancy, roles
4. **Document Management** - Upload, S3, metadata
5. **Background Processing** - BullMQ, PDF extraction
6. **RAG / AI** - Embeddings, vector search, LLM
7. **WebSockets** - Real-time updates
8. **Production Hardening** - Rate limiting, caching, security
9. **Testing** - Unit, integration, E2E tests
10. **CI/CD** - GitHub Actions pipelines
11. **AWS Deployment** - ECS, RDS, S3, CloudWatch

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
