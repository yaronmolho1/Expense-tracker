import { fetchExchangeRate } from '../lib/integrations/bank-of-israel-client';
import { db } from '../lib/db';
import { exchangeRates } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * One-time script to backfill exchange rates for last 2 years
 * Run with: docker compose exec app npx tsx scripts/backfill-exchange-rates.ts
 */
async function backfillExchangeRates() {
  console.log('[Backfill] Starting exchange rate backfill for last 2 years...');

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF'];
  const today = new Date();
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setFullYear(today.getFullYear() - 2);

  // Generate all dates from 2 years ago to today
  const datesToFetch: string[] = [];
  const currentDate = new Date(twoYearsAgo);

  while (currentDate <= today) {
    datesToFetch.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`[Backfill] Will fetch rates for ${datesToFetch.length} days × ${currencies.length} currencies = ${datesToFetch.length * currencies.length} total requests`);
  console.log(`[Backfill] Date range: ${datesToFetch[0]} to ${datesToFetch[datesToFetch.length - 1]}`);

  let fetchedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let apiCallCount = 0;

  for (const currency of currencies) {
    console.log(`\n[Backfill] Processing currency: ${currency}`);

    for (const date of datesToFetch) {
      try {
        // Check if already exists
        const existing = await db
          .select()
          .from(exchangeRates)
          .where(
            and(
              eq(exchangeRates.date, date),
              eq(exchangeRates.currency, currency)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          skippedCount++;
          continue;
        }

        // Fetch from API
        apiCallCount++;
        const rate = await fetchExchangeRate(date, currency);

        if (rate) {
          await db.insert(exchangeRates).values({
            date,
            currency,
            rateToIls: rate.toString(),
            source: 'api',
          });

          fetchedCount++;

          // Log progress every 50 successful fetches
          if (fetchedCount % 50 === 0) {
            console.log(`[Backfill] Progress: ${fetchedCount} fetched, ${skippedCount} skipped, ${errorCount} errors`);
          }
        } else {
          // No data available (weekend/holiday/future date)
          // This is normal - BOI doesn't publish on non-banking days
        }

        // Rate limit: wait 150ms between requests (more conservative for bulk fetch)
        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        errorCount++;
        console.error(`[Backfill] Error for ${currency} ${date}:`, error);

        // If too many errors, abort
        if (errorCount > 100) {
          console.error('[Backfill] Too many errors, aborting...');
          throw new Error('Backfill aborted due to excessive errors');
        }
      }
    }

    console.log(`[Backfill] ${currency} complete: ${fetchedCount} total fetched so far`);
  }

  console.log('\n[Backfill] Backfill completed!');
  console.log(`  Total API calls: ${apiCallCount}`);
  console.log(`  Successfully fetched: ${fetchedCount}`);
  console.log(`  Already existed (skipped): ${skippedCount}`);
  console.log(`  Errors: ${errorCount}`);

  process.exit(0);
}

backfillExchangeRates().catch((error) => {
  console.error('[Backfill] Fatal error:', error);
  process.exit(1);
});
