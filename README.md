# Expense Tracker

Personal expense tracking app with automated Israeli credit card statement parsing, AI categorization, and subscription detection.

## Features

- **Multi-Parser Support** - Auto-parse Isracard, Max, and Visa Cal credit card statements (Hebrew support)
- **AI Categorization** - Smart business categorization using Claude 3 Haiku with confidence scoring
- **Subscription Detection** - Pattern-based recurring payment detection with approval workflow
- **Business Management** - Merge duplicate businesses, manage AI suggestions, bulk operations
- **Installment Tracking** - Full installment payment tracking with grouping and timeline views
- **Multi-Currency** - ILS/USD/EUR support with historical exchange rates (Bank of Israel API)
- **Background Processing** - Async file processing with pg-boss job queue

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Shadcn/ui
- **Backend:** Next.js API Routes, Drizzle ORM, PostgreSQL 16
- **State:** TanStack Query v5 (optimistic updates, cache management)
- **AI:** Anthropic Claude 3 Haiku
- **Jobs:** pg-boss (PostgreSQL-based queue)
- **Testing:** Vitest (unit/integration), Playwright (E2E), 80%+ coverage
- **Deployment:** Docker Compose (multi-container: app, worker, db)

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10.28+
- Docker & Docker Compose

### Development

```bash
# Install dependencies
pnpm install

# Start database
docker compose up -d db

# Run migrations & seed
pnpm db:migrate
pnpm db:seed

# Start dev server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create `.env`:

```env
# Database
DATABASE_URL=postgresql://expenseuser:expensepass@localhost:5432/expensedb

# Auth (basic auth for MVP)
JWT_SECRET=your-secret-key-min-32-chars
AUTH_USERNAME=admin
AUTH_PASSWORD_HASH_BASE64=<bcrypt-hash-base64>

# AI
ANTHROPIC_API_KEY=sk-ant-...
```

**Generate password hash:**
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('yourpassword', 10).then(h => console.log(Buffer.from(h).toString('base64')))"
```

## Project Structure

```
app/
├── (dashboard)/          # Main app (transactions, manage, reports)
├── (auth)/               # Login page
└── api/                  # RESTful API routes

lib/
├── parsers/              # Credit card parsers (Isracard, Max, Visa Cal)
├── services/             # Business logic (categorization, subscriptions)
├── workers/              # Background job handlers (pg-boss)
├── db/                   # Schema, migrations, seed data
└── integrations/         # External APIs (Anthropic, Bank of Israel)

components/
├── features/             # Feature-specific components
├── ui/                   # Shadcn/ui primitives
└── layout/               # Shell, nav, header

tests/
├── unit/                 # Fast tests (no Docker)
├── integration/          # API + DB tests
└── e2e/                  # Playwright browser tests
```

## Commands

```bash
# Development
pnpm dev                  # Start dev server
pnpm build                # Production build
pnpm lint                 # Lint code
pnpm type-check           # TypeScript check

# Database
pnpm db:migrate           # Run migrations
pnpm db:seed              # Seed categories
pnpm db:studio            # Open Drizzle Studio (GUI)
pnpm db:clear             # Clear all tables

# Testing
pnpm test                 # All tests (unit + integration + e2e)
pnpm test:unit            # Unit tests only (fast, no Docker)
pnpm test:integration     # Integration tests (requires DB)
pnpm test:e2e             # E2E tests (requires app running)
pnpm test:coverage        # Coverage report
```

## Deployment

### Production

```bash
# On VPS
cd ~/docker-app-stack/apps/expense-tracker

# Pull latest
git pull origin main

# Build & start (db, app, worker)
docker compose -f docker-compose.production.yml up -d --build

# View logs
docker compose -f docker-compose.production.yml logs app -f
```

**Health checks:**
- App: `http://localhost:3000/api/health`
- Database: Auto-healthcheck via `pg_isready`

### Staging

```bash
docker compose -f docker-compose.staging.yml up -d
```

## Architecture Highlights

### Database Design
- 12 normalized tables with proper foreign keys
- Unique constraints prevent race conditions (`businesses.normalizedName`)
- Composite indexes for query optimization (`business_id, deal_date`)
- Partial indexes on nullable columns (installments, subscriptions)
- ACID transactions for multi-step operations

### Parser Architecture
- Abstract `BaseParser` class with factory pattern
- 3-layer card detection: filename → content → user selection
- Validation with tolerance checking (±10 ILS)
- Hebrew text support (regex patterns for installments)

### AI Categorization
- Batch processing (50 businesses/batch, 5 parallel batches)
- Confidence thresholds (>0.8 auto-apply, <0.8 review)
- Cost optimization (~$0.30 per 1000 businesses)
- Fallback logic for mismatched categories

### Background Jobs
- pg-boss for PostgreSQL-based job queue
- Retry with exponential backoff
- Separate worker container for scalability
- Idempotent job handlers

## Testing Strategy

- **Unit:** Services, parsers, utilities (no DB)
- **Integration:** API routes with test database
- **E2E:** Critical user flows (upload, categorize, merge)

Coverage targets: 80% lines, 80% functions, 75% branches

See [docs/TESTING.md](docs/TESTING.md) for details.

## Known Limitations

- Single-user authentication (basic auth - MVP only)
- In-memory rate limiting (single-server)
- Israeli credit card focus (parsers for IL market)
- No multi-tenancy (designed for personal use)

## Roadmap

- [ ] Replace basic auth with NextAuth.js
- [ ] Add Redis for caching & rate limiting
- [ ] Implement budget tracking UI
- [ ] Export to CSV/PDF
- [ ] Mobile-responsive improvements
- [ ] Advanced analytics dashboard

## Documentation

- [Testing Guide](docs/TESTING.md)
- [Testing Quick Start](docs/TESTING_QUICK_START.md)
- [Roadmap](docs/ROADMAP.md)

## License

Private project
