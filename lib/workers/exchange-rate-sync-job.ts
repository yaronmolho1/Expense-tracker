import { fetchExchangeRate } from '@/lib/integrations/bank-of-israel-client';
import { db } from '@/lib/db';
import { exchangeRates } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';

/**
 * Daily job to fetch and cache exchange rates
 * Runs every morning to ensure we have rates for recent transactions
 */
export async function syncExchangeRates() {
  logger.info({}, 'Starting exchange rate sync job');

  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF'];
  const today = new Date();
  const datesToSync: string[] = [];

  // Sync last 7 days (catch up on weekends/holidays)
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    datesToSync.push(date.toISOString().split('T')[0]);
  }

  let fetchedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const currency of currencies) {
    for (const date of datesToSync) {
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
        const rate = await fetchExchangeRate(date, currency);

        if (rate) {
          await db.insert(exchangeRates).values({
            date,
            currency,
            rateToIls: rate.toString(),
            source: 'api',
          });

          fetchedCount++;
          logger.info({ currency, date, rate }, 'Exchange rate fetched');
        } else {
          logger.warn({ currency, date }, 'Exchange rate not found');
        }

        // Rate limit: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errorCount++;
        logger.error(error, `Exchange rate sync error for ${currency} ${date}`);
      }
    }
  }

  logger.info({
    fetchedCount,
    skippedCount,
    errorCount,
  }, 'Exchange rate sync job completed');

  return {
    fetchedCount,
    skippedCount,
    errorCount,
  };
}
