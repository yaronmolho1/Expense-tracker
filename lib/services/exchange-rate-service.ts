import { db } from '@/lib/db';
import { exchangeRates } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { fetchExchangeRate } from '@/lib/integrations/bank-of-israel-client';

export interface ExchangeRateResult {
  rate: number;
  source: 'database' | 'api' | 'manual';
}

/**
 * Get exchange rate for a specific date and currency
 * Returns rate to convert foreign currency to ILS
 * Example: USD amount × rate = ILS amount
 */
export async function getExchangeRate(
  date: Date,
  currency: string
): Promise<ExchangeRateResult | null> {
  // Skip lookup if already ILS
  if (currency === 'ILS') {
    return { rate: 1, source: 'database' };
  }

  const dateString = date.toISOString().split('T')[0];

  // Try database first
  const cached = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.date, dateString),
        eq(exchangeRates.currency, currency)
      )
    )
    .limit(1);

  if (cached.length > 0) {
    return {
      rate: Number(cached[0].rateToIls),
      source: 'database',
    };
  }

  // Try API for USD/EUR
  if (currency === 'USD' || currency === 'EUR') {
    try {
      const apiRate = await fetchExchangeRate(dateString, currency);
      
      if (apiRate) {
        // Store in database for future use
        await db.insert(exchangeRates).values({
          date: dateString,
          currency,
          rateToIls: apiRate.toString(),
          source: 'api',
        });

        return { rate: apiRate, source: 'api' };
      }
    } catch (error) {
      console.error(`Failed to fetch ${currency} rate for ${dateString}:`, error);
    }
  }

  // Rate not found - requires manual entry
  return null;
}

/**
 * Manually store an exchange rate
 * Used when API doesn't support the currency (GBP, JPY, etc.)
 */
export async function storeManualRate(
  date: string,
  currency: string,
  rate: number
): Promise<void> {
  await db.insert(exchangeRates).values({
    date,
    currency,
    rateToIls: rate.toString(),
    source: 'manual',
  });
}

/**
 * Convert foreign amount to ILS
 */
export async function convertToILS(
  amount: number,
  currency: string,
  date: Date
): Promise<{ amountILS: number; rate: number | null } | null> {
  const rateResult = await getExchangeRate(date, currency);

  if (!rateResult) {
    return null;
  }

  return {
    amountILS: amount * rateResult.rate,
    rate: rateResult.rate,
  };
}
