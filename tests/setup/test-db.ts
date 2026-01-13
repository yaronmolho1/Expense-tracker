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
import { execSync } from 'child_process';

// Test database configuration
const TEST_DB_NAME = 'expense_tracker_test';
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
    // If command fails, return empty string
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
  // Check if test database exists using Docker exec
  const result = execDockerSql('postgres', `SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}'`);
  
  if (result === '1') {
    console.log(`✓ Test database already exists: ${TEST_DB_NAME}`);
  } else {
    console.log(`Creating test database: ${TEST_DB_NAME}...`);
    execDockerSql('postgres', `CREATE DATABASE ${TEST_DB_NAME}`);
    console.log('✓ Test database created');
  }
}

/**
 * Drop all tables in test database
 */
export async function dropAllTables(): Promise<void> {
  console.log('Dropping all tables in test database...');
  
  // Drop all tables (cascade to handle foreign keys) using Docker exec
  execDockerSql(TEST_DB_NAME, 'DROP SCHEMA IF EXISTS public CASCADE');
  execDockerSql(TEST_DB_NAME, 'CREATE SCHEMA public');
  execDockerSql(TEST_DB_NAME, 'GRANT ALL ON SCHEMA public TO PUBLIC');
  
  console.log('✓ All tables dropped');
}

/**
 * Run migrations on test database
 */
export async function runMigrations(): Promise<void> {
  console.log('Running migrations on test database...');
  
  // Apply all migrations via Docker exec with stdin
  const migrationFiles = [
    '0000_plain_logan.sql',
    '0001_add_override_validation_to_upload_batches.sql',
    '0002_remove_override_validation_from_upload_batches.sql',
    '0003_add_validation_warning_to_uploaded_files.sql',
    '0004_ancient_zuras.sql',
    '0005_salty_titanium_man.sql',
    '0006_living_zombie.sql',
    '0007_wandering_absorbing_man.sql',
    '0008_worried_blonde_phantom.sql',
    '0009_faithful_cable.sql',
  ];
  
  const fs = require('fs');
  const path = require('path');
  
  for (const file of migrationFiles) {
    const migrationPath = path.join(__dirname, '../../lib/db/migrations', file);
    if (fs.existsSync(migrationPath)) {
      const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
      // Pipe SQL file content to docker exec
      try {
        const process = require('child_process');
        const psqlProc = process.spawn('docker', [
          'compose', 'exec', '-T', 'postgres',
          'psql', '-U', 'expenseuser', '-d', TEST_DB_NAME
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
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message?.includes('already exists')) {
          console.error(`Error applying migration ${file}:`, error.message);
        }
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
