# Exchange Rate System Documentation

## Overview
The exchange rate system automatically converts foreign currency transactions to ILS using historical exchange rates.

## Components

### 1. Exchange Rate Service (`lib/services/exchange-rate-service.ts`)
**3-tier lookup strategy:**
1. **Database cache** - Check if rate already stored
2. **API fetch** - Call Bank of Israel API (currently using fallback)
3. **Manual entry** - Prompt user for unsupported currencies

**Key functions:**
- `getExchangeRate(date, currency)` - Get rate for specific date
- `convertToILS(amount, currency, date)` - Convert amount to ILS
- `storeManualRate(date, currency, rate)` - Store user-provided rate

### 2. Bank of Israel API Client (`lib/integrations/bank-of-israel-client.ts`)
**Current status:** Using fallback approximate rates (2024 averages)

**Fallback rates:**
- USD: 3.65
- EUR: 4.05
- GBP: 4.75
- JPY: 0.026
- CHF: 4.20

**Production TODO:**
- Configure proper BOI API endpoint
- Or integrate alternative: exchangerate-api.com, freecurrencyapi.com
- BOI official: https://www.boi.org.il/en/DataAndStatistics/Pages/MainPage.aspx

### 3. Daily Sync Job (`lib/workers/exchange-rate-sync-job.ts`)
**Schedule:** Every day at 6:00 AM Israel time (cron: `0 6 * * *`)

**Behavior:**
- Fetches last 7 days for USD, EUR, GBP, JPY, CHF
- Skips dates already in database (idempotent)
- Rate limiting: 100ms between requests
- Stores all rates in `exchange_rates` table

### 4. Transaction Processing Integration
**File:** `lib/workers/process-batch-job.ts`

**Flow:**
1. Parser extracts foreign transaction (e.g., 50 USD)
2. Check if parser provided exchange rate
3. If not, lookup via `convertToILS()`
4. Store both original (50 USD) and converted (182.50 ILS)
5. Use ILS amount for all calculations (installments, totals)

## Database Schema

```sql
CREATE TABLE exchange_rates (
  date VARCHAR(10) NOT NULL,        -- YYYY-MM-DD
  currency VARCHAR(3) NOT NULL,      -- ISO 4217 (USD, EUR, etc.)
  rate_to_ils DECIMAL(10,6) NOT NULL,  -- Conversion rate
  source VARCHAR(50) NOT NULL,       -- 'api', 'manual', 'fallback'
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (date, currency)
);
```

## Setup Instructions

### Initial Backfill (One-time)
Populate 2 years of historical rates:

```bash
# Run inside Docker container
docker compose exec app npx tsx scripts/backfill-exchange-rates.ts
```

**Progress:**
- 732 days × 5 currencies = 3,660 total requests
- Est. time: ~10 minutes (with 150ms rate limiting)

### Testing
Test the exchange rate system:

```bash
docker compose exec app npx tsx scripts/test-exchange-rates.ts
```

**Tests:**
1. Fetch single currency for specific date
2. Fetch all currencies for one date
3. Query database for saved rates
4. Test 7-day mini-backfill

### Manual Rate Entry
For unsupported currencies or missing dates:

```typescript
import { storeManualRate } from '@/lib/services/exchange-rate-service';

// Example: Store GBP rate for specific date
await storeManualRate('2024-12-15', 'GBP', 4.82);
```

## Usage in Application

### Automatic Conversion
When uploading bank files, foreign transactions are automatically converted:

```
1. Upload file with foreign transaction
2. Parser extracts: 50 USD, date 2024-12-15
3. System looks up USD rate for 2024-12-15
4. Converts: 50 × 3.65 = 182.50 ILS
5. Stores both amounts in database
```

### For Installments
First payment locks the exchange rate for all future payments:

```
1. First payment: 100 USD × 3.65 = 365 ILS (payment 1/12)
2. Projected payments: All use same 365 ILS per payment
3. When payment 2 arrives: Update projected → completed
```

## Monitoring

### Check Stored Rates
```sql
SELECT currency, COUNT(*) as days_cached
FROM exchange_rates
GROUP BY currency
ORDER BY currency;
```

### View Recent Rates
```sql
SELECT * FROM exchange_rates
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, currency;
```

### Check API vs Fallback
```sql
SELECT source, COUNT(*)
FROM exchange_rates
GROUP BY source;
```

## Production Checklist

- [ ] Configure real BOI API endpoint (or alternative API)
- [ ] Run initial 2-year backfill
- [ ] Verify daily sync job runs successfully
- [ ] Test foreign currency transaction upload
- [ ] Monitor API rate limits
- [ ] Set up alerts for sync job failures
- [ ] Document manual rate entry process for team

## Troubleshooting

### API Returning 404
**Current:** System uses fallback approximate rates
**Fix:** Update `lib/integrations/bank-of-israel-client.ts` with correct API endpoint

### Missing Rates for Specific Date
**Cause:** Weekend/holiday (banks don't publish rates)
**Solution:** System uses closest available rate or fallback

### Sync Job Not Running
**Check:**
1. Worker container is running: `docker compose ps worker`
2. Check worker logs: `docker compose logs worker`
3. Verify cron schedule in `scripts/worker.ts`

### Rate Seems Wrong
**Verify:**
1. Check source: `SELECT * FROM exchange_rates WHERE currency='USD' AND date='2024-12-15'`
2. If source='api': Rate is from fallback (update API)
3. If source='manual': User-entered
4. Compare with: https://www.boi.org.il/en/markets/exchangerates/

## Future Enhancements

1. **Real-time API**: Switch to proper BOI API or paid service
2. **More currencies**: Add CAD, AUD, etc.
3. **Rate alerts**: Notify on significant rate changes
4. **Historical analysis**: Track currency fluctuations
5. **Manual override UI**: Allow editing rates via dashboard
