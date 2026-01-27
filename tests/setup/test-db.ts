/**
 * Test Database Utilities
 * 
 * Provides utilities for managing the test database:
 * - Create/drop test database
 * - Reset schema
 * - Seed test data
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { execSync, spawn } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Test database configuration
const TEST_DB_NAME = 'expense_tracker_test';
const MAIN_DB_URL = process.env.DATABASE_URL || 'postgresql://expenseuser:expensepass@localhost:5432/expense_tracker';

// Detect if running in CI environment
const IS_CI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

// Parse main DB URL to get connection params
function parseDbUrl(url: string) {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) throw new Error('Invalid DATABASE_URL format');
  
  const [, user, password, host, port, database] = match;
  return { user, password, host, port: parseInt(port), database };
}

/**
 * Execute SQL (works in both CI and local Docker)
 */
function execSqlQuery(database: string, sql: string): string {
  const { user, password } = parseDbUrl(MAIN_DB_URL);
  
  try {
    if (IS_CI) {
      // CI: Direct psql connection
      return execSync(
        `psql -h localhost -U ${user} -d ${database} -tAc "${sql}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PGPASSWORD: password } }
      ).trim();
    } else {
      // Local: Use docker compose
      return execSync(
        `docker compose exec -T postgres psql -U ${user} -d ${database} -tAc "${sql}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
    }
  } catch (error: any) {
    return '';
  }
}

/**
 * Get connection URL for test database
 */
export function getTestDbUrl(): string {
  const params = parseDbUrl(MAIN_DB_URL);
  return `postgresql://${params.user}:${params.password}@${params.host}:${params.port}/${TEST_DB_NAME}`;
}

/**
 * Create test database if it doesn't exist
 */
export async function createTestDatabase(): Promise<void> {
  // Check if test database exists
  const result = execSqlQuery('postgres', `SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}'`);
  
  if (result === '1') {
    console.log(`✓ Test database already exists: ${TEST_DB_NAME}`);
  } else {
    console.log(`Creating test database: ${TEST_DB_NAME}...`);
    execSqlQuery('postgres', `CREATE DATABASE ${TEST_DB_NAME}`);
    console.log('✓ Test database created');
  }
}

/**
 * Drop all tables in test database
 */
export async function dropAllTables(): Promise<void> {
  console.log('Dropping all tables in test database...');
  
  // Drop all tables (cascade to handle foreign keys)
  execSqlQuery(TEST_DB_NAME, 'DROP SCHEMA IF EXISTS public CASCADE');
  execSqlQuery(TEST_DB_NAME, 'CREATE SCHEMA public');
  execSqlQuery(TEST_DB_NAME, 'GRANT ALL ON SCHEMA public TO PUBLIC');
  
  console.log('✓ All tables dropped');
}

/**
 * Run migrations on test database
 */
export async function runMigrations(): Promise<void> {
  console.log('Running migrations on test database...');

  const migrationsDir = join(__dirname, '../../lib/db/migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  const { user, password } = parseDbUrl(MAIN_DB_URL);

  for (const file of migrationFiles) {
    const migrationPath = join(migrationsDir, file);

    try {
      if (IS_CI) {
        // CI: Use direct psql with file input
        execSync(
          `psql -h localhost -U ${user} -d ${TEST_DB_NAME} < "${migrationPath}"`,
          { encoding: 'utf-8', stdio: 'ignore', env: { ...process.env, PGPASSWORD: password } }
        );
      } else {
        // Local: Use docker compose with piped stdin
        const migrationSql = readFileSync(migrationPath, 'utf-8');
        const psqlProc = spawn('docker', [
          'compose', 'exec', '-T', 'postgres',
          'psql', '-U', user, '-d', TEST_DB_NAME
        ], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        psqlProc.stdin.write(migrationSql);
        psqlProc.stdin.end();
        
        await new Promise<void>((resolve, reject) => {
          let stderr = '';
          psqlProc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
          
          psqlProc.on('close', (code: number) => {
            if (code !== 0 && !stderr.includes('already exists')) {
              reject(new Error(`Migration ${file} failed: ${stderr}`));
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error: any) {
      // Ignore "already exists" errors
      if (!error.message?.includes('already exists')) {
        console.error(`Error applying migration ${file}:`, error.message);
      }
    }
  }
  
  console.log('✓ Migrations completed');
}

/**
 * Reset test database to clean state
 * - Drops all tables
 * - Runs migrations
 * - Seeds basic data
 */
export async function resetTestDatabase(): Promise<void> {
  console.log('\n=== Resetting Test Database ===\n');
  
  await createTestDatabase();
  await dropAllTables();
  await runMigrations();
  
  console.log('\n✓ Test database reset complete\n');
}

/**
 * Get a connection to the test database
 */
export function getTestDbConnection() {
  return postgres(getTestDbUrl());
}
