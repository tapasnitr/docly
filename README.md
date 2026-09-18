# Docly - AI Document Processing & Collaboration SaaS

A production-style SaaS platform for document processing and AI-powered document Q&A.

## Project Structure

```
docly/
├── apps/
│   ├── web/       # Next.js frontend
│   ├── api/       # Fastify REST API
│   └── worker/    # Background job worker
├── packages/
│   ├── database/  # Prisma ORM and schema
│   ├── config/    # Configuration management
│   ├── types/     # Shared TypeScript types
│   └── logger/    # Logging utilities
├── infra/
│   ├── docker/    # Dockerfiles
│   └── nginx/     # Nginx reverse proxy config
└── docker-compose.yml  # Local development setup
```

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
- pnpm >= 8
- Docker & Docker Compose
- macOS (or Linux with Docker)

### Setup

1. Clone the repository and navigate to the project:

```bash
cd /Volumes/GAURANGA/coding/project/docly
```

2. Copy environment configuration:

```bash
cp .env.example .env
```

3. Install dependencies:

```bash
pnpm install
```

4. Start Docker services:

```bash
docker-compose up -d
```

5. Run database migrations:

```bash
pnpm db:push
```

6. Start development servers:

```bash
pnpm dev
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
pnpm dev
```

### Build for production

```bash
pnpm build
```

### Database operations

```bash
# Run migrations
pnpm db:migrate

# Push schema changes
pnpm db:push

# Open Prisma Studio UI
pnpm db:studio
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
