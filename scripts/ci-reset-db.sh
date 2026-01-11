#!/bin/bash
# CI Database Reset Script
# Truncates all tables for clean slate between test suites

set -e

echo "=== Resetting Test Database ==="

# Database connection details
DB_USER="${POSTGRES_USER:-expenseuser}"
DB_PASSWORD="${POSTGRES_PASSWORD:-testpass}"
DB_NAME="${POSTGRES_DB:-expensedb_test}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

# Truncate all tables (faster than drop/recreate)
PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" <<EOF
-- Disable triggers for faster truncation
SET session_replication_role = replica;

-- Truncate all tables
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END \$\$;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Verify clean state
SELECT 'Truncated ' || COUNT(*) || ' tables' FROM pg_tables WHERE schemaname = 'public';
EOF

echo "✓ Database reset complete"
