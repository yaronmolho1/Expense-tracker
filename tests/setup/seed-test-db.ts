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

/**
 * Execute SQL via docker compose exec
 */
function execSql(sql: string): void {
  try {
    execSync(
      `docker compose exec -T postgres psql -U expenseuser -d ${TEST_DB_NAME} -c "${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
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
