/**
 * Bank of Israel API Client
 * Fetches historical exchange rates from official source
 *
 * NOTE: The BOI SDMX API endpoint structure needs verification.
 * Currently using fallback approximate rates for MVP.
 * Production should integrate: https://www.boi.org.il/en/DataAndStatistics/Pages/MainPage.aspx
 * Or alternative: exchangerate-api.com, freecurrencyapi.com
 */

interface BoiApiResponse {
  dataSets: Array<{
    series: Record<string, {
      observations: Record<string, [number]>;
    }>;
  }>;
}

const BOI_API_BASE = 'https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/ER';

// Fallback approximate rates (2024 averages) - used when API unavailable
const FALLBACK_RATES: Record<string, number> = {
  USD: 3.65,
  EUR: 4.05,
  GBP: 4.75,
  JPY: 0.026,
  CHF: 4.20,
};

// Currency codes used by Bank of Israel API
const CURRENCY_CODES: Record<string, string> = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY',
  CHF: 'CHF',
};

/**
 * Fetch exchange rate for a specific date and currency
 * @param date - Date in YYYY-MM-DD format
 * @param currency - ISO 4217 currency code (USD, EUR, etc.)
 * @returns Rate to convert 1 unit of foreign currency to ILS, or null if not found
 */
export async function fetchExchangeRate(
  date: string,
  currency: string
): Promise<number | null> {
  const currencyCode = CURRENCY_CODES[currency];

  if (!currencyCode) {
    console.warn(`Currency ${currency} not supported by Bank of Israel API`);
    return null;
  }

  try {
    // Convert YYYY-MM-DD to YYYY-MM format for API
    const [year, month] = date.split('-');
    const monthParam = `${year}-${month}`;

    const url = `${BOI_API_BASE}/${currencyCode}/dataflow?startPeriod=${monthParam}&endPeriod=${monthParam}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`BOI API returned ${response.status} for ${currency} on ${date} - using fallback rate`);
      return FALLBACK_RATES[currency] || null;
    }

    const data: BoiApiResponse = await response.json();

    // Extract rate from nested structure
    const series = data.dataSets?.[0]?.series;
    
    if (!series) {
      console.warn(`No data found for ${currency} on ${date}`);
      return null;
    }

    // Get the first series (usually index "0:0:0:0")
    const seriesKey = Object.keys(series)[0];
    const observations = series[seriesKey]?.observations;

    if (!observations) {
      return null;
    }

    // Find observation matching our date
    // Observations are keyed by date offset from start
    const dateKey = Object.keys(observations).find(key => {
      // This is simplified - BOI API uses time series indices
      // For production, parse the structure metadata
      return true;
    });

    if (!dateKey) {
      return null;
    }

    const rate = observations[dateKey][0];
    return rate;

  } catch (error) {
    console.warn(`Error fetching exchange rate for ${currency} on ${date} - using fallback rate:`, error);
    return FALLBACK_RATES[currency] || null;
  }
}

/**
 * Fetch latest available rate for a currency
 * Useful for recent transactions when exact date might not be available yet
 */
export async function fetchLatestRate(currency: string): Promise<number | null> {
  const today = new Date().toISOString().split('T')[0];
  return fetchExchangeRate(today, currency);
}
