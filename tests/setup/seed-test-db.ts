/**
 * Seed Test Database
 * 
 * Seeds the test database with minimal required data:
 * - Categories (from production seed)
 * - Test cards
 * - Test upload batch
 */

import { execSync } from 'child_process';

const TEST_DB_NAME = 'expense_tracker_test';
const IS_CI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

// Parse DB credentials from DATABASE_URL or TEST_DATABASE_URL
function parseDbUrl(url: string) {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) return { user: 'expenseuser', password: 'expensepass' };
  return { user: match[1], password: match[2] };
}

const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://expenseuser:expensepass@localhost:5432/expense_tracker_test';
const { user: DB_USER, password: DB_PASSWORD } = parseDbUrl(dbUrl);

/**
 * Execute SQL (works in both CI and local Docker)
 */
function execSql(sql: string): void {
  try {
    if (IS_CI) {
      // CI: Direct psql connection
      execSync(
        `psql -h localhost -U ${DB_USER} -d ${TEST_DB_NAME} -c "${sql.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', stdio: 'pipe', env: { ...process.env, PGPASSWORD: DB_PASSWORD } }
      );
    } else {
      // Local: Use docker compose
      execSync(
        `docker compose exec -T postgres psql -U ${DB_USER} -d ${TEST_DB_NAME} -c "${sql.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
    }
  } catch (error: any) {
    // Ignore some common errors
    if (!error.message?.includes('already exists') && !error.message?.includes('duplicate key')) {
      throw error;
    }
  }
}

/**
 * Seed categories (same as production)
 */
function seedCategories() {
  console.log('Seeding categories...');
  
  // Parent categories (level 0)
  const parentCategories = [
    'Food & Dining',
    'Transportation',
    'Shopping',
    'Entertainment',
    'Bills & Utilities',
    'Health & Fitness',
    'Travel',
    'Personal Care',
    'Education',
  ];

  for (let i = 0; i < parentCategories.length; i++) {
    execSql(`INSERT INTO categories (name, level, parent_id, display_order) VALUES ('${parentCategories[i]}', 0, NULL, ${i})`);
  }

  // Child categories (level 1) - just a few for testing
  const childCategories = [
    { name: 'Groceries', parentName: 'Food & Dining' },
    { name: 'Restaurants', parentName: 'Food & Dining' },
    { name: 'Gas', parentName: 'Transportation' },
    { name: 'Clothing', parentName: 'Shopping' },
    { name: 'Electronics', parentName: 'Shopping' },
  ];

  for (let i = 0; i < childCategories.length; i++) {
    const child = childCategories[i];
    execSql(`INSERT INTO categories (name, level, parent_id, display_order) SELECT '${child.name}', 1, id, ${i} FROM categories WHERE name = '${child.parentName}' AND level = 0`);
  }

  console.log(`✓ Seeded ${parentCategories.length + childCategories.length} categories`);
}

/**
 * Seed test cards
 */
function seedTestCards() {
  console.log('Seeding test cards...');
  
  const testCards = [
    { owner: 'default-user', last4: '1234', nickname: 'Test Max Card', bank: 'Discount Bank', handler: 'max' },
    { owner: 'default-user', last4: '5678', nickname: 'Test Visa Cal', bank: 'Discount Bank', handler: 'visa' },
    { owner: 'default-user', last4: '9012', nickname: 'Test Isracard', bank: 'Isracard', handler: 'isracard' },
  ];

  for (const card of testCards) {
    execSql(`INSERT INTO cards (owner, last_4_digits, nickname, bank_or_company, file_format_handler, is_active) VALUES ('${card.owner}', '${card.last4}', '${card.nickname}', '${card.bank}', '${card.handler}', true)`);
  }

  console.log(`✓ Seeded ${testCards.length} test cards`);
}

/**
 * Seed test upload batch
 */
function seedTestBatch() {
  console.log('Seeding test upload batch...');
  
  execSql(`INSERT INTO upload_batches (status, file_count, total_amount_ils) VALUES ('completed', 0, 0)`);

  console.log('✓ Seeded test upload batch');
}

/**
 * Main seed function
 * 
 * Note: User authentication is via environment variables (AUTH_USERNAME, AUTH_PASSWORD_HASH_BASE64)
 * configured in playwright.config.ts, not a database table
 */
export function seedTestDatabase(): void {
  seedCategories();
  seedTestCards();
  seedTestBatch();
  
  console.log('\n✓ Test database seeding complete\n');
  console.log('Note: Auth credentials configured via environment variables:');
  console.log('  - Username: gili');
  console.log('  - Password: y1a3r5o7n\n');
}
