/**
 * Test script to verify exchange rate fetching works
 * Run with: docker compose exec app npx tsx scripts/test-exchange-rates.ts
 */

import { fetchExchangeRate } from '../lib/integrations/bank-of-israel-client';
import { db } from '../lib/db';
import { exchangeRates } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function testExchangeRates() {
  console.log('[Test] Testing exchange rate API...\n');

  // Test 1: Fetch a specific recent date
  const testDate = '2024-12-01';
  const testCurrency = 'USD';

  console.log(`[Test 1] Fetching ${testCurrency} rate for ${testDate}`);
  const rate = await fetchExchangeRate(testDate, testCurrency);

  if (rate) {
    console.log(`✓ Success: ${testCurrency} rate = ${rate} ILS`);

    // Try to save to database
    try {
      await db.insert(exchangeRates).values({
        date: testDate,
        currency: testCurrency,
        rateToIls: rate.toString(),
        source: 'api',
      });
      console.log(`✓ Saved to database\n`);
    } catch (error) {
      // Might fail if already exists - that's okay
      console.log(`Note: ${error}\n`);
    }
  } else {
    console.log(`✗ Failed to fetch rate\n`);
  }

  // Test 2: Fetch multiple currencies for one date
  console.log(`[Test 2] Fetching all currencies for ${testDate}`);
  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF'];

  for (const currency of currencies) {
    const rate = await fetchExchangeRate(testDate, currency);
    if (rate) {
      console.log(`✓ ${currency}: ${rate} ILS`);
    } else {
      console.log(`✗ ${currency}: Failed`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Test 3: Query database
  console.log(`\n[Test 3] Querying database for saved rates`);
  const savedRates = await db
    .select()
    .from(exchangeRates)
    .where(eq(exchangeRates.date, testDate))
    .limit(10);

  console.log(`Found ${savedRates.length} rates in database for ${testDate}:`);
  savedRates.forEach(r => {
    console.log(`  ${r.currency}: ${r.rateToIls} (source: ${r.source})`);
  });

  // Test 4: Test last 7 days mini-backfill
  console.log(`\n[Test 4] Testing 7-day backfill`);
  const today = new Date();
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const rate = await fetchExchangeRate(dateStr, 'USD');
    if (rate) {
      successCount++;
      try {
        await db.insert(exchangeRates).values({
          date: dateStr,
          currency: 'USD',
          rateToIls: rate.toString(),
          source: 'api',
        });
      } catch (e) {
        // Ignore duplicates
      }
    } else {
      failCount++;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`✓ Successfully fetched: ${successCount}/7 days`);
  console.log(`✗ Failed: ${failCount}/7 days (likely weekends/future dates)`);

  console.log('\n[Test] All tests complete!');
  process.exit(0);
}

testExchangeRates().catch((error) => {
  console.error('[Test] Error:', error);
  process.exit(1);
});
