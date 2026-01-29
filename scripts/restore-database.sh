#!/bin/bash
#
# Database Restore Script
# 
# Restores PostgreSQL database from backup file.
#
# Usage: ./scripts/restore-database.sh /path/to/backup.sql.gz

set -e  # Exit on error

BACKUP_FILE="$1"
CONTAINER_NAME="${DB_CONTAINER:-expense-tracker-prod-db}"
DB_USER="${POSTGRES_USER:-expenseuser}"
DB_NAME="${POSTGRES_DB:-expensedb}"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Error: No backup file specified"
  echo "Usage: $0 /path/to/backup.sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  WARNING: This will overwrite the current database!"
echo "Database: $DB_NAME"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Restore cancelled"
  exit 0
fi

echo "🔄 Starting database restore..."

# Drop existing connections
docker exec "$CONTAINER_NAME" psql \
  -U "$DB_USER" \
  -d postgres \
  -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
  || true

# Drop and recreate database
docker exec "$CONTAINER_NAME" psql \
  -U "$DB_USER" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS $DB_NAME;"

docker exec "$CONTAINER_NAME" psql \
  -U "$DB_USER" \
  -d postgres \
  -c "CREATE DATABASE $DB_NAME;"

# Restore from backup
gunzip < "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql \
  -U "$DB_USER" \
  -d "$DB_NAME"

echo "✅ Database restored successfully!"
echo "⚠️  Remember to restart the application containers:"
echo "   docker compose restart app worker"
