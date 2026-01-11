#!/bin/bash
#
# Database Backup Script
# 
# Backs up the PostgreSQL database to compressed file.
# Keeps last 30 days of backups.
#
# Usage: ./scripts/backup-database.sh

set -e  # Exit on error

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/expense-tracker}"
CONTAINER_NAME="${DB_CONTAINER:-expense-tracker-prod-db}"
DB_USER="${POSTGRES_USER:-expenseuser}"
DB_NAME="${POSTGRES_DB:-expensedb}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting database backup..."
echo "Database: $DB_NAME"
echo "Container: $CONTAINER_NAME"

# Create backup
docker exec "$CONTAINER_NAME" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  | gzip > "$BACKUP_FILE"

# Check if backup was successful
if [ -f "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
else
  echo "❌ Backup failed!"
  exit 1
fi

# Delete backups older than 30 days
echo "🧹 Cleaning up old backups (keeping last 30 days)..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" | wc -l)
echo "📊 Total backups: $BACKUP_COUNT"

echo "✅ Backup complete!"
