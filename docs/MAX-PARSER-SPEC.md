# MAX Credit Card Statement Parser Specification

## Overview

Parser for Israeli **Discount Bank MAX** credit card statements in `.xlsx` format.

**Key Characteristics:**
- **Multiple sheets** per file (3-5 sheets)
- **16-column structure** (richest metadata among all parsers)
- **Hebrew text** throughout
- Complex transaction types (foreign currency, installments, pending, immediate)

---

## File Structure

### Sheet Types (5 possible, 2 required)

| Sheet Name (Hebrew) | English | Required | Frequency | Purpose |
|---|---|---|---|---|
| `עסקאות במועד החיוב` | Regular Billing | ✅ REQUIRED | 100% | Standard monthly charges |
| `עסקאות חו"ל ומט"ח` | Foreign Currency | Optional | 63% | Foreign transactions with exchange rates |
| `עסקאות בחיוב מיידי` | Immediate Charge | Optional | 25% | ATM withdrawals, immediate debits |
| `עסקאות שאושרו וטרם נקלטו` | Pending | Optional | 13% | Approved but not yet charged |
| `עסקאות לידיעה` | Informational | Optional | 13% | Future transactions (FYI) |

### Row Structure (Identical Across ALL Sheets)

```
Row 0: User filter       → "כל המשתמשים (1)"              [SKIP]
Row 1: Card filter       → "כל הכרטיסים (2)"              [SKIP]
Row 2: Statement period  → "08/2025"                      [EXTRACT: MM/YYYY]
Row 3: HEADER            → 16 columns                     [VALIDATE]
Row 4+: DATA             → Transaction rows               [PARSE]
...
Last-2: Footer label     → "סך הכל"                      [SKIP]
Last-1: Total amount     → "4889.27₪"                     [SKIP]
Last-0: Empty row        → null                           [SKIP]
```

### Column Structure (16 columns)

| Index | Hebrew | English | Type | Notes |
|---|---|---|---|---|
| 0 | תאריך עסקה | Deal date | Date | Format: `DD-MM-YYYY` |
| 1 | שם בית העסק | Business name | String | May have excess whitespace |
| 2 | קטגוריה | Category | String | Bank's category |
| 3 | 4 ספרות אחרונות של כרטיס האשראי | Card last 4 | String | e.g., `"7229"` |
| 4 | סוג עסקה | Transaction type | Enum | See transaction types |
| 5 | סכום חיוב | Charged amount | Number | **NULL** for pending transactions |
| 6 | מטבע חיוב | Charged currency | String | `"₪"`, `"$"`, `"€"`, `""` |
| 7 | סכום עסקה מקורי | Original amount | Number | Always populated |
| 8 | מטבע עסקה מקורי | Original currency | String | `""` = Yen (if JP location) |
| 9 | תאריך חיוב | Charge date | Date | **NULL** for pending, format: `DD-MM-YYYY` |
| 10 | הערות | Notes | String | Contains installment info |
| 11 | תיוגים | Tags | String | User tags |
| 12 | מועדון הנחות | Discount club | String | Loyalty program |
| 13 | מפתח דיסקונט | Discount key | String | Discount identifier |
| 14 | אופן ביצוע ההעסקה | Execution method | String | See execution methods |
| 15 | שער המרה ממטבע מקור/התחשבנות לש"ח | Exchange rate | String | **Leading space** + decimal |

---

## Data Formats

### Dates
- **Format**: `DD-MM-YYYY` (string)
- **Examples**: `"06-09-2023"`, `"17-12-2024"`, `"15-01-2025"`
- **Pending**: `תאריך חיוב` is `null`

### Amounts
- **Type**: Plain number (no currency symbol)
- **Examples**: `80`, `3550.55`, `421.61`, `-14.8` (refund)
- **Decimals**: 2 decimal places

### Currencies
- **Shekel**: `"₪"` → `ILS`
- **Dollar**: `"$"` → `USD`
- **Euro**: `"€"` → `EUR`
- **Yen**: `""` (empty) → `JPY` (if business location = JP)
- **Default**: Empty = `ILS`

### Exchange Rate
- **Format**: String with **leading space** + decimal
- **Examples**: `" 0.0235"`, `" 3.4020"`, `" 3.9778"`
- **Empty**: `""` when no conversion
- **Parsing**: Trim whitespace, parse as float

---

## Transaction Types

| Hebrew | English | Description |
|---|---|---|
| `רגילה` | Regular | Standard single payment |
| `תשלומים` | Installments | Installment payment |
| `דחוי חודש` | Deferred month | Foreign/deferred charge |
| `קרדיט` | Credit | Credit/refund transaction |
| `חיוב עסקות מיידי` | Immediate charge | ATM withdrawal, immediate debit |

---

## Execution Methods

| Hebrew | English |
|---|---|
| `בנוכחות כרטיס` | Card present (physical swipe/chip) |
| `תשלום בנייד` | Mobile payment (NFC, app) |
| `אינטרנט` | Internet purchase |
| `טלפוני` | Phone order |
| `עסקה חכמה` | Smart transaction (contactless) |

---

## Special Cases

### 1. Installments

**Detection:**
- `סוג עסקה` = `"תשלומים"` **OR**
- `הערות` matches pattern: `/תשלום\s+(\d+)\s+מתוך\s+(\d+)/`

**Examples:**
```
"תשלום 24 מתוך 36"  → index: 24, total: 36
"תשלום 2 מתוך 3"    → index: 2, total: 3
```

**Fields:**
- `סכום עסקה מקורי`: Total purchase amount
- `סכום חיוב`: This month's installment payment

---

### 2. Refunds/Cancellations

**Detection:**
- `סכום חיוב` < 0 (negative) **OR**
- `הערות` contains `"ביטול עסקה"` **OR**
- `סוג עסקה` = `"קרדיט"`

**Example:**
```typescript
{
  businessName: "סופרפארם הדסה עין כרם",
  chargedAmount: -14.8,
  notes: "ביטול עסקה",
  transactionType: "charge",
  isRefund: true
}
```

---

### 3. Pending Transactions

**Sheet**: `עסקאות שאושרו וטרם נקלטו`

**Characteristics:**
- `סכום חיוב`: **NULL** (not charged yet)
- `תאריך חיוב`: **NULL**
- `סכום עסקה מקורי`: Populated (expected amount)

**Handling:**
- Use `סכום עסקה מקורי` as the amount
- Set `status = 'projected'`
- `bankChargeDate = undefined`

**Example:**
```typescript
{
  dealDate: new Date('2025-08-03'),
  businessName: "מאפה נאמן הדסה עין כרם",
  chargedAmountIls: 15.5,  // From סכום עסקה מקורי
  bankChargeDate: undefined,
  status: 'projected',
  rawRow: { chargedAmount: null, chargeDate: null }
}
```

---

### 4. Foreign Currency

**Sheet**: `עסקאות חו"ל ומט"ח`

#### Pattern A: True Foreign (with conversion)
```typescript
{
  chargedAmount: 3550.55,
  chargedCurrency: "₪",
  originalAmount: 149226,
  originalCurrency: "",        // Empty = Yen
  exchangeRate: " 0.0235",
  businessName: "...OSAKA JP"
}
// Calculation: 149226 × 0.0235 = 3550.55 ₪
```

#### Pattern B: Foreign merchant, ILS billing
```typescript
{
  chargedAmount: 754.48,
  chargedCurrency: "₪",
  originalAmount: 754.48,
  originalCurrency: "₪",
  exchangeRate: "",
  notes: "חיוב עסקת חו\"ל בש\"ח "
}
```

#### Pattern C: USD/EUR conversion
```typescript
{
  chargedAmount: 15.48,
  chargedCurrency: "₪",
  originalAmount: 4.5,
  originalCurrency: "$",
  exchangeRate: " 3.4020"
}
// Calculation: 4.5 × 3.4020 = 15.48 ₪
```

---

### 5. ATM Withdrawals

**Sheet**: `עסקאות בחיוב מיידי`

**Characteristics:**
- `שם בית העסק`: Contains `"כספומט"` (ATM)
- `קטגוריה`: `"משיכת מזומן"`
- `סוג עסקה`: `"חיוב עסקות מיידי"`
- `תאריך חיוב`: **Same day or next day** (not month-end)

**Example:**
```typescript
{
  dealDate: new Date('2024-12-17'),
  bankChargeDate: new Date('2024-12-20'),  // Immediate
  businessName: "כספומט הפועלים  שליח",
  category: "משיכת מזומן",
  transactionType: "חיוב עסקות מיידי",
  chargedAmountIls: 2100
}
```

---

## Parser Implementation

### Algorithm Flow

```typescript
1. Load workbook (XLSX.readFile)
2. Validate required sheet exists: 'עסקאות במועד החיוב'
3. Extract metadata from first sheet (Row 2: period)
4. For each sheet (in priority order):
   a. Validate header (Row 3)
   b. Extract data rows (Row 4 to end-3)
   c. Parse each transaction
   d. Transform to standard format
5. Return ParserResult
```

### Sheet Processing Priority

```typescript
const SHEET_PRIORITY = [
  'עסקאות במועד החיוב',      // Regular billing
  'עסקאות חו"ל ומט"ח',       // Foreign currency
  'עסקאות בחיוב מיידי',      // Immediate charges
  'עסקאות שאושרו וטרם נקלטו', // Pending
  'עסקאות לידיעה'            // Informational
];
```

### Key Functions

#### 1. Header Validation
```typescript
function isValidHeader(header: string[]): boolean {
  const expectedColumns = [
    'תאריך עסקה',
    'שם בית העסק',
    'סכום חיוב',
    // ... (check all 16)
  ];

  return expectedColumns.every(col => header.includes(col));
}
```

#### 2. Date Parsing
```typescript
function parseMaxDate(dateStr: string): Date {
  // Format: "DD-MM-YYYY"
  const [day, month, year] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
```

#### 3. Exchange Rate Parsing
```typescript
function parseExchangeRate(rateStr: string): number | undefined {
  if (!rateStr || rateStr.trim() === '') return undefined;
  return parseFloat(rateStr.trim());  // Trim leading space
}
```

#### 4. Installment Parsing
```typescript
function parseInstallment(notes: string): {
  isInstallment: boolean;
  currentPayment?: number;
  totalPayments?: number;
} {
  const match = notes.match(/תשלום\s+(\d+)\s+מתוך\s+(\d+)/);
  if (!match) return { isInstallment: false };

  return {
    isInstallment: true,
    currentPayment: parseInt(match[1]),
    totalPayments: parseInt(match[2])
  };
}
```

---

## Output Format

### ParsedTransaction Interface

```typescript
interface ParsedTransaction {
  // Business
  businessName: string;

  // Dates
  dealDate: Date;
  bankChargeDate?: Date;  // undefined for pending

  // Amounts
  originalAmount: number;
  originalCurrency: string;      // ISO code: ILS, USD, EUR, JPY
  chargedAmountIls: number;
  exchangeRateUsed?: number;

  // Payment type
  paymentType: 'regular' | 'installments' | 'credit';

  // Installments
  installmentIndex?: number;
  installmentTotal?: number;

  // Card
  cardLast4: string;

  // Transaction type
  transactionType: 'charge' | 'refund' | 'adjustment';

  // Status
  status: 'completed' | 'projected' | 'cancelled';

  // Refund flag
  isRefund: boolean;

  // Metadata
  bankCategory?: string | null;
  notes?: string | null;
  rawRow?: unknown;
}
```

---

## Edge Cases

| Case | Handling |
|---|---|
| Missing sheets | Skip gracefully (only `עסקאות במועד החיוב` required) |
| Pending transactions | Use `originalAmount`, set `status='projected'`, `bankChargeDate=undefined` |
| Empty currency | Infer Yen from business name (`JP` location) |
| Negative amount | Mark as refund |
| Missing exchange rate | Set to `undefined` (not an error) |
| Excessive whitespace in names | Clean with `/\s{2,}/g` → single space |
| Zero amounts | Not found in analyzed data (may indicate data error) |

---

## Testing

### Test Files
- `uploads/Use cases/MAX/01.25 - 7229.xlsx` (3 sheets, with refund)
- `uploads/Use cases/MAX/08.25 - 7229.xlsx` (4 sheets, with pending & foreign)

### Run Tests
```bash
cd expense-tracker
npx tsx test-max-parser.ts
```

### Expected Output
```
File: 01.25 - 7229.xlsx
  Total Transactions: 36
  Regular: 32, Installments: 4
  Refunds: 1
  Foreign: 0

File: 08.25 - 7229.xlsx
  Total Transactions: 22
  Pending: 3
  Foreign: 4
  Refunds: 1
```

---

## Implementation Checklist

- ✅ Multi-sheet detection & iteration
- ✅ Header validation (Row 3)
- ✅ Date parsing (`DD-MM-YYYY`)
- ✅ Amount parsing (handle `null`)
- ✅ Currency normalization (`₪` → `ILS`)
- ✅ Exchange rate parsing (trim whitespace)
- ✅ Installment detection (regex on `הערות`)
- ✅ Pending transaction handling (`status='projected'`)
- ✅ Refund detection (negative + notes check)
- ✅ Business name cleanup (excess whitespace)
- ✅ Comprehensive notes field (merge tags, discount, method)

---

## Performance Notes

- **File size**: ~30-50KB per statement
- **Parse time**: ~100-200ms per file
- **Memory**: Minimal (XLSX streaming not needed for these sizes)

---

## Known Limitations

1. **BIT transfers**: Not found in analyzed files, handling TBD
2. **Empty currency = Yen**: Assumes `JP` in business name; may need refinement
3. **Zero amounts**: Not handled (assumed data error, not found in samples)

---

**END OF SPECIFICATION**
