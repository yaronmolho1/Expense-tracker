# Expense Tracker

Personal expense tracking app with automated credit card statement parsing, smart categorization, and subscription detection.

## Features

- **Automated Parsing** - Upload credit card statements (Max, Visa Cal, Isracard) and extract transactions automatically
- **Smart Categorization** - AI-powered business categorization with manual override support
- **Subscription Detection** - Automatically identifies recurring charges
- **Budget Tracking** - Set category budgets and track spending
- **Multi-Currency** - Handles ILS/USD with historical exchange rates
- **Business Management** - Merge duplicate businesses, manage suggestions

## Tech Stack

- **Frontend:** Next.js 16, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes, Drizzle ORM
- **Database:** PostgreSQL 16
- **AI:** Anthropic Claude (categorization)
- **Testing:** Vitest (unit/integration), Playwright (E2E)
- **Deployment:** Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop
- PostgreSQL 16

### Development Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker compose up -d postgres

# Run migrations
npm run db:migrate

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create `.env.local`:

```env
DATABASE_URL=postgresql://expenseuser:expensepass@localhost:5432/expense_tracker
JWT_SECRET=your-secret-key
AUTH_USERNAME=your-username
AUTH_PASSWORD_HASH_BASE64=base64-encoded-bcrypt-hash
ANTHROPIC_API_KEY=your-api-key
```

## Testing

```bash
# Unit tests (fast, no Docker needed)
npm run test:unit

# All tests (requires Docker)
npm test
```

**Note:** Integration/E2E tests require stable Docker. If Docker crashes locally, tests run automatically in GitHub Actions on push.

See [docs/TESTING.md](docs/TESTING.md) for details.

## Deployment

### Staging
```bash
docker compose -f docker-compose.staging.yml up -d
```

### Production
```bash
docker compose -f docker-compose.production.yml up -d
```

Deployments run automatically via GitHub Actions after tests pass.

## Project Structure

```
app/                 # Next.js app routes
├── (dashboard)/     # Main app pages
├── (auth)/          # Login page
└── api/             # API endpoints

lib/
├── parsers/         # Credit card statement parsers
├── services/        # Business logic
├── workers/         # Background jobs
└── db/              # Database schema & migrations

components/          # React components
tests/               # Unit, integration, E2E tests
docs/                # Documentation
```

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run linter
npm test             # Run all tests
npm run test:unit    # Unit tests only

npm run db:migrate   # Run migrations
npm run db:studio    # Database GUI
```

## Documentation

- [Testing Guide](docs/TESTING.md) - Complete testing setup
- [Testing Quick Start](docs/TESTING_QUICK_START.md) - Quick reference

## License

Private project
