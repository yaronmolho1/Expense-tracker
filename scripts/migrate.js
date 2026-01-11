#!/usr/bin/env node
/**
 * Database Migration Runner (Compiled for Production)
 *
 * Runs pending migrations in CI/CD and production.
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const postgres = require('postgres');
const path = require('path');

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');

  try {
    // Create connection for migrations
    const connection = postgres(databaseUrl, { max: 1 });
    const db = drizzle(connection);

    const migrationsFolder = path.join(__dirname, '../lib/db/migrations');

    console.log(`📁 Migrations folder: ${migrationsFolder}`);
    console.log('🚀 Running migrations...');

    await migrate(db, { migrationsFolder });

    console.log('✅ Migrations completed successfully');

    // Close connection
    await connection.end();

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run migrations
runMigrations();
