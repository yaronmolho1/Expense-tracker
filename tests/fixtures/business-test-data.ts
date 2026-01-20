/**
 * Test Fixtures: Business Test Data
 *
 * Provides helper functions for generating test data for business filter tests.
 * These fixtures help create consistent test scenarios across unit, integration, and E2E tests.
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

const dbUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://expenseuser:expensepass@localhost:5432/expense_tracker_test';
const { user: DB_USER, password: DB_PASSWORD } = parseDbUrl(dbUrl);

/**
 * Execute SQL (works in both CI and local Docker)
 */
function execSql(sql: string): void {
  try {
    if (IS_CI) {
      execSync(
        `psql -h localhost -U ${DB_USER} -d ${TEST_DB_NAME} -c "${sql.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', stdio: 'pipe', env: { ...process.env, PGPASSWORD: DB_PASSWORD } }
      );
    } else {
      execSync(
        `docker compose exec -T postgres psql -U ${DB_USER} -d ${TEST_DB_NAME} -c "${sql.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
    }
  } catch (error: any) {
    if (!error.message?.includes('already exists') && !error.message?.includes('duplicate key')) {
      throw error;
    }
  }
}

/**
 * Seed uncategorized businesses for testing
 * Creates 5 businesses with primary_category_id = NULL
 */
export function seedUncategorizedBusinesses(): void {
  console.log('Seeding uncategorized businesses...');

  const uncategorizedBusinesses = [
    'Uncategorized Store A',
    'Uncategorized Shop B',
    'Uncategorized Merchant C',
    'Uncategorized Vendor D',
    'Uncategorized Business E',
  ];

  for (const name of uncategorizedBusinesses) {
    const normalized = name.toLowerCase().replace(/\s+/g, '_');
    execSql(`
      INSERT INTO businesses (normalized_name, display_name, primary_category_id, approved)
      VALUES ('${normalized}', '${name}', NULL, true)
      ON CONFLICT (normalized_name) DO NOTHING
    `);
  }

  console.log(`✓ Seeded ${uncategorizedBusinesses.length} uncategorized businesses`);
}

/**
 * Seed categorized businesses for testing
 * Creates 10 businesses with valid category assignments
 */
export function seedCategorizedBusinesses(): void {
  console.log('Seeding categorized businesses...');

  const categorizedBusinesses = [
    { name: 'Grocery Store Alpha', category: 'Groceries' },
    { name: 'Restaurant Beta', category: 'Restaurants' },
    { name: 'Gas Station Gamma', category: 'Gas' },
    { name: 'Clothing Store Delta', category: 'Clothing' },
    { name: 'Electronics Shop Epsilon', category: 'Electronics' },
    { name: 'Grocery Store Zeta', category: 'Groceries' },
    { name: 'Restaurant Eta', category: 'Restaurants' },
    { name: 'Gas Station Theta', category: 'Gas' },
    { name: 'Clothing Store Iota', category: 'Clothing' },
    { name: 'Electronics Shop Kappa', category: 'Electronics' },
  ];

  for (const business of categorizedBusinesses) {
    const normalized = business.name.toLowerCase().replace(/\s+/g, '_');
    execSql(`
      INSERT INTO businesses (normalized_name, display_name, primary_category_id, approved)
      SELECT '${normalized}', '${business.name}', id, true
      FROM categories
      WHERE name = '${business.category}'
      LIMIT 1
      ON CONFLICT (normalized_name) DO NOTHING
    `);
  }

  console.log(`✓ Seeded ${categorizedBusinesses.length} categorized businesses`);
}

/**
 * Seed transactions with specific date ranges for testing
 * Creates transactions spread across different time periods
 */
export function seedTransactionsWithDateRanges(): void {
  console.log('Seeding transactions with date ranges...');

  // Get business IDs (first 15 businesses)
  const businessIds = Array.from({ length: 15 }, (_, i) => i + 1);

  // Create transactions for different date ranges
  const dateRanges = [
    { start: '2023-01-01', end: '2023-12-31', count: 30 }, // 2023 full year
    { start: '2024-01-01', end: '2024-06-30', count: 60 }, // 2024 H1
    { start: '2024-07-01', end: '2024-12-31', count: 60 }, // 2024 H2
  ];

  let transactionCount = 0;

  for (const range of dateRanges) {
    const startDate = new Date(range.start);
    const endDate = new Date(range.end);
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i < range.count; i++) {
      const randomDays = Math.floor(Math.random() * daysDiff);
      const dealDate = new Date(startDate);
      dealDate.setDate(dealDate.getDate() + randomDays);

      const bankChargeDate = new Date(dealDate);
      bankChargeDate.setDate(bankChargeDate.getDate() + 2);

      const amount = (Math.random() * 500 + 50).toFixed(2);
      const businessId = businessIds[i % businessIds.length];
      const cardId = (i % 3) + 1; // Cycle through 3 test cards
      const status = i % 10 === 0 ? 'projected' : 'completed';
      const transactionHash = `test_daterange_${range.start}_${i}_${Date.now()}`;

      execSql(`
        INSERT INTO transactions
        (transaction_hash, transaction_type, business_id, card_id, deal_date, bank_charge_date,
         original_amount, original_currency, charged_amount_ils, payment_type, status,
         is_refund, source_file, upload_batch_id)
        VALUES (
          '${transactionHash}',
          'one_time',
          ${businessId},
          ${cardId},
          '${dealDate.toISOString().split('T')[0]}',
          '${bankChargeDate.toISOString().split('T')[0]}',
          ${amount},
          'ILS',
          ${amount},
          'one_time',
          '${status}',
          false,
          'test_fixture.csv',
          1
        )
        ON CONFLICT (transaction_hash) DO NOTHING
      `);

      transactionCount++;
    }
  }

  console.log(`✓ Seeded ${transactionCount} transactions with date ranges`);
}

/**
 * Seed complete test dataset for business filter tests
 * Combines all fixtures for comprehensive testing
 */
export function seedCompleteBusinessFilterTestData(): void {
  console.log('\n=== Seeding Complete Business Filter Test Data ===\n');

  seedUncategorizedBusinesses();
  seedCategorizedBusinesses();
  seedTransactionsWithDateRanges();

  console.log('\n✓ Complete business filter test data seeded successfully\n');
}

/**
 * Clear test data (use with caution)
 */
export function clearBusinessTestData(): void {
  console.log('Clearing business test data...');

  execSql('DELETE FROM transactions WHERE source_file LIKE \'test_%\'');
  execSql('DELETE FROM businesses WHERE normalized_name LIKE \'%uncategorized%\'');
  execSql('DELETE FROM businesses WHERE normalized_name IN (\'grocery_store_alpha\', \'restaurant_beta\', \'gas_station_gamma\')');

  console.log('✓ Business test data cleared');
}

/**
 * Business filter test data summary
 */
export interface BusinessTestDataSummary {
  uncategorizedCount: number;
  categorizedCount: number;
  transactionCount: number;
  dateRanges: string[];
}

/**
 * Get summary of test data
 */
export function getTestDataSummary(): BusinessTestDataSummary {
  return {
    uncategorizedCount: 5,
    categorizedCount: 10,
    transactionCount: 150, // 30 + 60 + 60
    dateRanges: [
      '2023-01-01 to 2023-12-31 (30 transactions)',
      '2024-01-01 to 2024-06-30 (60 transactions)',
      '2024-07-01 to 2024-12-31 (60 transactions)',
    ],
  };
}
