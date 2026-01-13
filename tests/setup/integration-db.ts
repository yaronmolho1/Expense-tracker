/**
 * Integration Test Database Utilities
 * 
 * Separate database for integration tests to allow parallel execution with E2E tests.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Integration test database configuration
const INTEGRATION_DB_NAME = 'expense_tracker_integration';
const MAIN_DB_URL = process.env.DATABASE_URL || 'postgresql://expenseuser:expensepass@localhost:5432/expense_tracker';

// Parse main DB URL to get connection params
function parseDbUrl(url: string) {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) throw new Error('Invalid DATABASE_URL format');
  
  const [, user, password, host, port, database] = match;
  return { user, password, host, port: parseInt(port), database };
}

/**
 * Execute SQL via docker compose exec (bypasses host authentication)
 */
function execDockerSql(database: string, sql: string): string {
  const user = parseDbUrl(MAIN_DB_URL).user;
  try {
    return execSync(
      `docker compose exec -T postgres psql -U ${user} -d ${database} -tAc "${sql}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
  } catch (error: any) {
    return '';
  }
}

/**
 * Get connection URL for integration test database
 */
export function getIntegrationDbUrl(): string {
  const params = parseDbUrl(MAIN_DB_URL);
  return `postgresql://${params.user}:${params.password}@${params.host}:${params.port}/${INTEGRATION_DB_NAME}`;
}

/**
 * Create integration test database if it doesn't exist
 */
export async function createIntegrationDatabase(): Promise<void> {
  console.log(`Creating integration test database: ${INTEGRATION_DB_NAME}...`);
  
  // Check if database exists
  const checkResult = execDockerSql('postgres', `SELECT 1 FROM pg_database WHERE datname='${INTEGRATION_DB_NAME}'`);
  
  if (checkResult === '1') {
    console.log('Integration test database already exists');
    return;
  }
  
  // Create database
  execDockerSql('postgres', `CREATE DATABASE ${INTEGRATION_DB_NAME}`);
  console.log(`Created integration test database: ${INTEGRATION_DB_NAME}`);
}

/**
 * Drop all tables in integration test database (clean slate)
 */
export async function dropAllTables(): Promise<void> {
  console.log('Dropping all tables in integration test database...');
  
  const user = parseDbUrl(MAIN_DB_URL).user;
  try {
    execSync(
      `docker compose exec -T postgres psql -U ${user} -d ${INTEGRATION_DB_NAME} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`,
      { encoding: 'utf-8', stdio: 'ignore' }
    );
  } catch (error) {
    // Schema might not exist yet, that's okay
  }
}

/**
 * Run all migrations on integration test database
 */
export async function runMigrations(): Promise<void> {
  console.log('Running migrations on integration test database...');
  
  const migrationsDir = path.join(process.cwd(), 'lib', 'db', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  const user = parseDbUrl(MAIN_DB_URL).user;
  
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    console.log(`  Running migration: ${file}`);
    
    try {
      execSync(
        `docker compose exec -T postgres psql -U ${user} -d ${INTEGRATION_DB_NAME} < "${filePath}"`,
        { encoding: 'utf-8', stdio: 'ignore' }
      );
    } catch (error: any) {
      console.error(`Failed to run migration ${file}:`, error.message);
      throw error;
    }
  }
  
  console.log('All migrations completed');
}

/**
 * Seed minimal test data
 */
export async function seedIntegrationDatabase(): Promise<void> {
  console.log('Seeding integration test database...');
  
  const user = parseDbUrl(MAIN_DB_URL).user;
  
  // Seed categories (hierarchical structure: level 0 = parent, level 1 = child)
  const categorySql = `INSERT INTO categories (name, parent_id, level, display_order) VALUES ('Test Parent Category', NULL, 0, 0), ('Test Child Category', 1, 1, 0) ON CONFLICT DO NOTHING;`;
  
  try {
    execSync(
      `docker compose exec -T postgres psql -U ${user} -d ${INTEGRATION_DB_NAME} -c "${categorySql}"`,
      { encoding: 'utf-8', stdio: 'ignore' }
    );
  } catch (error) {
    // Seed errors are non-fatal in integration tests
    console.warn('Warning: Could not seed categories (may already exist)');
  }
  
  console.log('Integration test database seeded');
}

/**
 * Reset integration test database (drop, recreate schema, run migrations, seed)
 */
export async function resetIntegrationDatabase(): Promise<void> {
  console.log('Resetting integration test database...');
  
  await createIntegrationDatabase();
  await dropAllTables();
  await runMigrations();
  await seedIntegrationDatabase();
  
  console.log('Integration test database reset complete');
}
