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
if command -v drizzle-kit >/dev/null 2>&1; then
  # Use global drizzle-kit installation
  # drizzle-kit migrate will handle connection retries internally
  if drizzle-kit migrate; then
    echo "✅ Migrations completed successfully"
  else
    EXIT_CODE=$?
    echo "⚠️  Migration exited with code $EXIT_CODE"
    echo "   This may be normal if:"
    echo "   - Migrations are already applied"
    echo "   - Database is not ready yet (will retry on next startup)"
    echo "   - Migration files are missing"
    echo "   The application will start anyway - migrations can be run manually if needed:"
    echo "   docker compose exec app drizzle-kit migrate"
  fi
else
  echo "⚠️  Warning: drizzle-kit not found, skipping migrations"
  echo "   Migrations should be run manually: drizzle-kit migrate"
fi

# Start the application (this should always run)
echo "🚀 Starting application..."
exec node server.js
