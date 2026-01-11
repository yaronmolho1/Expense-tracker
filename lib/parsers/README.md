# Bank Statement Parsers

This directory contains parsers for different bank statement formats.

## Available Parsers

### ✅ VISA/CAL Parser (Production Ready)
**File:** `visa-cal-parser.ts`
**Bank:** Discount Bank (דיסקונט)
**Format:** `.xlsx`
**Status:** Tested & Validated

**Detection:**
- Sheet name contains "דיסקונט"
- Row 0 contains "ויזה" and "המסתיים"
- Row 3 or 4 has valid header

**Capabilities:**
- ✓ Installments (תשלום X מתוך Y)
- ✓ Foreign currency (USD, JPY, EUR)
- ✓ Refunds (זיכוי)
- ✓ Subscriptions (keyword detection)
- ✓ Bank categories

**Test Results:** 6/6 files passed, 53 transactions

---

## Base Parser Interface

All parsers must extend `BaseParser` class:

```typescript
import { BaseParser, ParserResult } from './base-parser';

export class YourParser extends BaseParser {
  constructor(fileName: string) {
    super(fileName);
  }

  async canParse(filePath: string): Promise<boolean> {
    // Detect if this parser can handle the file
  }

  async parse(filePath: string): Promise<ParserResult> {
    // Parse the file and return transactions
  }

  getName(): string {
    return 'your-parser-name';
  }
}
```

## ParsedTransaction Interface

All parsers must return transactions matching this interface:

```typescript
interface ParsedTransaction {
  // Required fields
  businessName: string;
  dealDate: Date;
  originalAmount: number;
  originalCurrency: string;      // ISO 4217: "ILS", "USD", "EUR"
  chargedAmountIls: number;
  paymentType: 'one_time' | 'installments';
  isRefund: boolean;
  isSubscription: boolean;
  sourceFileName: string;

  // Optional fields
  bankChargeDate?: Date;
  exchangeRateUsed?: number;
  installmentIndex?: number;     // 1-based
  installmentTotal?: number;
  bankCategory?: string | null;
  notes?: string | null;
  rawRow?: unknown;
}
```

## Testing Your Parser

1. Create test file: `__tests__/test-your-parser.ts`
2. Use the VISA/CAL test as a template
3. Test with real bank files
4. Verify all fields are populated correctly

```typescript
const parser = new YourParser(fileName);

// Test detection
const canParse = await parser.canParse(filePath);

// Test parsing
const result = await parser.parse(filePath);

// Validate
result.transactions.forEach(tx => {
  assert(tx.businessName);
  assert(tx.paymentType === 'one_time' || tx.paymentType === 'installments');
  assert(tx.isRefund !== undefined);
  assert(tx.isSubscription !== undefined);
});
```

## Parser Factory

Once your parser is ready, add it to `parser-factory.ts`:

```typescript
const parsers = [
  new VisaCalParser(fileName),
  new YourParser(fileName),
  // ... more parsers
];

for (const parser of parsers) {
  if (await parser.canParse(filePath)) {
    return parser.parse(filePath);
  }
}
```

## Documentation

Each parser should have:
1. **Spec document** in `/docs/` (e.g., `VISA-CAL-PARSER-SPEC.md`)
2. **Validation report** (e.g., `VISA-CAL-PARSER-VALIDATION.md`)
3. **Test file** in `__tests__/`

## Common Utilities

Consider creating shared utilities for:
- Date parsing (Israeli format: D/M/YY)
- Amount parsing (with currency symbols)
- Excel file reading
- Hebrew text handling

---

**Next Steps:**
1. Implement `parser-factory.ts`
2. Create remaining parsers (Isracard, MAX, Leumi)
3. Integrate into background worker pipeline
