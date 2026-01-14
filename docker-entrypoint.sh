#!/bin/sh
# Don't use set -e here - we want the app to start even if migrations fail

echo "🚀 Starting Expense Tracker application..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  Warning: DATABASE_URL is not set"
  echo "   Database connections will fail"
fi

# Wait a moment for database to be fully ready
# Docker Compose handles this via depends_on, but a small delay ensures
# the database is ready to accept connections
echo "⏳ Waiting for database to be ready..."
sleep 2

# Run database migrations (don't fail if migrations fail)
echo "🔄 Running database migrations..."
if command -v tsx >/dev/null 2>&1 && [ -f "./scripts/migrate.ts" ]; then
  # Use migrate.ts script which uses drizzle-orm directly
  # This works better in standalone builds where drizzle-orm is in node_modules
  if tsx ./scripts/migrate.ts; then
    echo "✅ Migrations completed successfully"
  else
    EXIT_CODE=$?
    echo "⚠️  Migration exited with code $EXIT_CODE"
    echo "   This may be normal if:"
    echo "   - Migrations are already applied"
    echo "   - Database is not ready yet (will retry on next startup)"
    echo "   - Migration files are missing"
    echo "   The application will start anyway - migrations can be run manually if needed:"
    echo "   docker compose exec app tsx scripts/migrate.ts"
  fi
elif command -v drizzle-kit >/dev/null 2>&1; then
  # Fallback to drizzle-kit if tsx/migrate.ts not available
  if drizzle-kit migrate; then
    echo "✅ Migrations completed successfully"
  else
    EXIT_CODE=$?
    echo "⚠️  Migration exited with code $EXIT_CODE"
    echo "   This may be normal if migrations are already applied"
    echo "   The application will start anyway - migrations can be run manually if needed:"
    echo "   docker compose exec app drizzle-kit migrate"
  fi
else
  echo "⚠️  Warning: Neither tsx nor drizzle-kit found, skipping migrations"
  echo "   Migrations should be run manually: tsx scripts/migrate.ts"
fi

# Start the application (this should always run)
echo "🚀 Starting application..."
exec node server.js
