import * as XLSX from 'xlsx';
import { BaseParser, ParsedTransaction, ParserResult, ParserMetadata, ParseError, ParseWarning } from './base-parser';

/**
 * MAX Parser for Discount Bank MAX statements
 * Format: .xlsx with Hebrew text, multiple sheets
 * See: /docs/MAX-PARSER-SPEC.md
 */

// ============================================
// TYPES
// ============================================

// Type for Excel worksheet data - array of rows, where each row is an array of cell values
type ExcelRow = (string | number | boolean | Date | null | undefined)[];
type ExcelData = ExcelRow[];

interface MaxRawTransaction {
  dealDate: string;
  businessName: string;
  category: string;
  cardLast4: string;
  transactionType: string;
  chargedAmount: number | null;
  chargedCurrency: string;
  originalAmount: number;
  originalCurrency: string;
  chargeDate: string | null;
  notes: string;
  tags: string;
  discountClub: string;
  discountKey: string;
  executionMethod: string;
  exchangeRate: string;
  sheetName: string;
  rowIndex: number;
}

// ============================================
// CONSTANTS
// ============================================

const SHEET_NAMES = {
  REGULAR: 'עסקאות במועד החיוב',
  FOREIGN: 'עסקאות חו"ל ומט"ח',
  IMMEDIATE: 'עסקאות בחיוב מיידי',
  PENDING: 'עסקאות שאושרו וטרם נקלטו',
  INFO: 'עסקאות לידיעה',
} as const;

const SHEET_PRIORITY = [
  SHEET_NAMES.REGULAR,
  SHEET_NAMES.FOREIGN,
  SHEET_NAMES.IMMEDIATE,
  SHEET_NAMES.PENDING,
  SHEET_NAMES.INFO,
];

const EXPECTED_HEADER = [
  'תאריך עסקה',
  'שם בית העסק',
  'קטגוריה',
  '4 ספרות אחרונות של כרטיס האשראי',
  'סוג עסקה',
  'סכום חיוב',
  'מטבע חיוב',
  'סכום עסקה מקורי',
  'מטבע עסקה מקורי',
  'תאריך חיוב',
  'הערות',
  'תיוגים',
  'מועדון הנחות',
  'מפתח דיסקונט',
  'אופן ביצוע ההעסקה',
  'שער המרה ממטבע מקור/התחשבנות לש"ח',
];

const REGEX_PATTERNS = {
  installment: /תשלום\s+(\d+)\s+מתוך\s+(\d+)/,
  date: /^(\d{2})-(\d{2})-(\d{4})$/,
  period: /^(\d{2})\/(\d{4})$/,
  cancellation: /ביטול עסקה/,
  subscription: /הוראת קבע/,
};

const TRANSACTION_TYPES = {
  REGULAR: 'רגילה',
  INSTALLMENTS: 'תשלומים',
  DEFERRED_MONTH: 'דחוי חודש',
  IMMEDIATE_CHARGE: 'חיוב עסקות מיידי',
} as const;

const SUBSCRIPTION_KEYWORDS = [
  'netflix',
  'spotify',
  'apple',
  'google',
  'microsoft',
  'adobe',
  'amazon prime',
  'youtube',
];

// ============================================
// MAX PARSER CLASS
// ============================================

export class MaxParser extends BaseParser {
  /**
   * Extract card last 4 digits from file header (static method for card detection)
   * @param rows - First 10 rows of the Excel sheet
   * @returns {last4: string} or null if not found
   */
  static extractCardFromHeader(rows: (string | number | null)[][]): { last4: string } | null {
    // Card number is in row 4 (index 3), in the column "4 ספרות אחרונות של כרטיס האשראי"
    const header = rows[3];
    if (!header) return null;

    const cardColIndex = header.indexOf('4 ספרות אחרונות של כרטיס האשראי');
    if (cardColIndex < 0) return null;

    // Get first transaction row to extract the card number
    const firstTransaction = rows[4];
    if (!firstTransaction) return null;

    const cardLast4 = String(firstTransaction[cardColIndex] || '').trim();
    return cardLast4 && /^\d{4}$/.test(cardLast4) ? { last4: cardLast4 } : null;
  }

  /**
   * Check if this parser can handle the given file
   */
  async canParse(filePath: string): Promise<boolean> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;

      // Try to find ANY valid MAX sheet (not just REGULAR)
      let validSheet = null;

      // First, try the regular sheet
      if (sheetNames.includes(SHEET_NAMES.REGULAR)) {
        validSheet = workbook.Sheets[SHEET_NAMES.REGULAR];
      } else {
        // Fallback: Try other sheet types in priority order
        for (const sheetName of SHEET_PRIORITY) {
          if (sheetNames.includes(sheetName)) {
            validSheet = workbook.Sheets[sheetName];
            break;
          }
        }

        // If no priority sheet found, try first sheet
        if (!validSheet && sheetNames.length > 0) {
          validSheet = workbook.Sheets[sheetNames[0]];
        }
      }

      if (!validSheet) {
        return false;
      }

      // Validate sheet structure
      const rows = XLSX.utils.sheet_to_json<any[]>(validSheet, {
        header: 1,
        defval: null,
      });

      // Check row 2 for period format (MM/YYYY)
      const row2 = rows[2]?.[0];
      if (!row2 || !REGEX_PATTERNS.period.test(String(row2))) {
        return false;
      }

      // Check row 3 for expected header
      const header = rows[3];
      if (!this.isValidMaxHeader(header)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse MAX statement file
   */
  async parse(filePath: string): Promise<ParserResult> {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    const errors: ParseError[] = [];
    const warnings: ParseWarning[] = [];

    // Find first available sheet (try REGULAR first, then fallback)
    let metadataSheetName: string = SHEET_NAMES.REGULAR;

    if (!sheetNames.includes(SHEET_NAMES.REGULAR)) {
      // Fallback: Find first available sheet in priority order
      let found = false;
      for (const sheetName of SHEET_PRIORITY) {
        if (sheetNames.includes(sheetName)) {
          metadataSheetName = sheetName;
          found = true;
          console.log(`[MaxParser] Using fallback sheet for metadata: ${sheetName}`);
          break;
        }
      }

      if (!found && sheetNames.length > 0) {
        metadataSheetName = sheetNames[0];
        console.log(`[MaxParser] Using first available sheet: ${metadataSheetName}`);
      } else if (!found) {
        throw new Error('No valid sheets found in MAX file');
      }
    }

    // Extract metadata from first available sheet
    const firstSheet = workbook.Sheets[metadataSheetName];
    const firstSheetData = XLSX.utils.sheet_to_json<(string | number | null)[]>(firstSheet, {
      header: 1,
      defval: null,
    });

    const metadata = this.extractMetadata(firstSheetData, sheetNames);

    // Parse all sheets
    const allTransactions: ParsedTransaction[] = [];

    for (const sheetName of SHEET_PRIORITY) {
      if (!sheetNames.includes(sheetName)) continue;

      const worksheet = workbook.Sheets[sheetName];
      const { transactions, errors: sheetErrors, warnings: sheetWarnings } = this.parseSheet(
        worksheet,
        sheetName,
        metadata
      );

      allTransactions.push(...transactions);
      errors.push(...sheetErrors);
      warnings.push(...sheetWarnings);
    }

    // Add sourceFileName to all transactions
    allTransactions.forEach((tx) => {
      tx.sourceFileName = this.fileName;
    });

    return {
      metadata,
      transactions: allTransactions,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Get parser name
   */
  getName(): string {
    return 'max';
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private isValidMaxHeader(header: ExcelRow | undefined): boolean {
    if (!header) return false;

    const requiredColumns = [
      'תאריך עסקה',
      'שם בית העסק',
      'סכום חיוב',
      'מטבע חיוב',
    ];

    return requiredColumns.every((col) => header.some((cell) => cell === col));
  }

  private extractMetadata(
    rows: (string | number | null)[][],
    sheetNames: string[]
  ): ParserMetadata {
    // Row 2 contains period: "08/2025"
    const periodCell = rows[2]?.[0];
    if (!periodCell || typeof periodCell !== 'string') {
      throw new Error('Cannot extract statement period from row 2');
    }

    const periodMatch = periodCell.match(REGEX_PATTERNS.period);
    if (!periodMatch) {
      throw new Error(`Invalid period format: ${periodCell}`);
    }

    return {
      cardLast4: '', // Will be populated from first transaction
      statementMonth: periodCell,
    };
  }

  private parseSheet(
    worksheet: XLSX.WorkSheet,
    sheetName: string,
    metadata: ParserMetadata
  ): {
    transactions: ParsedTransaction[];
    errors: ParseError[];
    warnings: ParseWarning[];
  } {
    const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
      header: 1,
      defval: null,
    });

    const errors: ParseError[] = [];
    const warnings: ParseWarning[] = [];

    // Validate header (row 3)
    const header = data[3];
    if (!this.isValidHeader(header)) {
      throw new Error(`Invalid header in sheet: ${sheetName}`);
    }

    // Extract data rows (row 4 to end-3)
    const dataRows = data.slice(4, -3);

    // Parse transactions
    const transactions: ParsedTransaction[] = [];

    dataRows.forEach((row, index) => {
      const rowIndex = index + 4; // Account for header offset

      if (!this.isValidDataRow(row)) return;

      try {
        const rawTransaction = this.parseRawTransaction(row, header as string[], sheetName, rowIndex);
        const parsedTransaction = this.transformToStandardFormat(rawTransaction, metadata, warnings, rowIndex);

        // Set card last 4 from first transaction
        if (metadata.cardLast4 === '') {
          metadata.cardLast4 = rawTransaction.cardLast4 || 'unknown';
        }

        transactions.push(parsedTransaction);
      } catch (error) {
        errors.push({
          row: rowIndex,
          message: error instanceof Error ? error.message : 'Unknown error',
          data: row,
        });
      }
    });

    return { transactions, errors, warnings };
  }

  private isValidHeader(header: (string | number | null)[] | undefined): boolean {
    if (!header) return false;
    return EXPECTED_HEADER.every((expectedCol) => header.some((col) => col === expectedCol));
  }

  private isValidDataRow(row: (string | number | null)[] | undefined): boolean {
    if (!row) return false;
    if (row.every((cell) => cell === null || cell === '')) return false;
    if (row[0] === 'סך הכל') return false;
    return true;
  }

  private parseRawTransaction(
    row: (string | number | null)[],
    header: string[],
    sheetName: string,
    rowIndex: number
  ): MaxRawTransaction {
    const getCol = (name: string): string | number | null => {
      const index = header.indexOf(name);
      return index >= 0 ? row[index] : null;
    };

    const getString = (name: string): string => {
      const value = getCol(name);
      return value ? String(value).trim() : '';
    };

    const getNumber = (name: string): number | null => {
      const value = getCol(name);
      if (value === null || value === '') return null;
      return typeof value === 'number' ? value : parseFloat(String(value));
    };

    return {
      dealDate: getString('תאריך עסקה'),
      businessName: getString('שם בית העסק'),
      category: getString('קטגוריה'),
      cardLast4: getString('4 ספרות אחרונות של כרטיס האשראי'),
      transactionType: getString('סוג עסקה'),
      chargedAmount: getNumber('סכום חיוב'),
      chargedCurrency: getString('מטבע חיוב'),
      originalAmount: getNumber('סכום עסקה מקורי') ?? 0,
      originalCurrency: getString('מטבע עסקה מקורי'),
      chargeDate: getString('תאריך חיוב') || null,
      notes: getString('הערות'),
      tags: getString('תיוגים'),
      discountClub: getString('מועדון הנחות'),
      discountKey: getString('מפתח דיסקונט'),
      executionMethod: getString('אופן ביצוע ההעסקה'),
      exchangeRate: getString('שער המרה ממטבע מקור/התחשבנות לש"ח'),
      sheetName,
      rowIndex,
    };
  }

  private transformToStandardFormat(
    raw: MaxRawTransaction,
    metadata: ParserMetadata,
    warnings: ParseWarning[],
    rowIndex: number
  ): ParsedTransaction {
    const isPending = raw.sheetName === SHEET_NAMES.PENDING;

    // Parse dates
    const dealDate = this.parseMaxDate(raw.dealDate);
    const bankChargeDate = raw.chargeDate ? this.parseMaxDate(raw.chargeDate) : undefined;

    // Handle pending transactions
    let chargedAmount = raw.chargedAmount ?? raw.originalAmount;

    if (isPending) {
      warnings.push({
        row: rowIndex,
        message: 'Pending transaction - charged amount not finalized',
        data: { businessName: raw.businessName },
      });
    }

    // Parse currency with enhanced detection
    let originalCurrency = raw.originalCurrency || raw.chargedCurrency || '';

    // Enhanced Yen detection
    if (originalCurrency === '') {
      const japanIndicators = ['JP', 'TOKYO', 'OSAKA', 'JAPAN', '日本'];
      const hasJapanIndicator = japanIndicators.some((ind) =>
        raw.businessName.toUpperCase().includes(ind)
      );

      if (hasJapanIndicator) {
        originalCurrency = 'JPY';
      } else {
        originalCurrency = 'ILS';
      }
    }

    // Normalize currency to ISO codes
    const normalizedOriginalCurrency = this.normalizeCurrency(originalCurrency);
    const normalizedChargedCurrency = this.normalizeCurrency(raw.chargedCurrency);

    // Parse exchange rate
    const exchangeRate = this.parseExchangeRate(raw.exchangeRate);

    // Parse installment info
    const installmentInfo = this.parseInstallment(raw.notes, raw.transactionType);

    // Detect subscription first (takes priority)
    const isSubscription = this.detectSubscription(raw.notes, raw.businessName, raw.executionMethod);

    // Determine payment type (subscription takes priority over installments)
    const paymentType = this.determinePaymentType(raw.transactionType, installmentInfo.isInstallment, isSubscription);

    // Detect refund (FIX: removed CREDIT type)
    const isRefund = chargedAmount < 0 || REGEX_PATTERNS.cancellation.test(raw.notes);

    return {
      businessName: this.cleanBusinessName(raw.businessName),
      dealDate,
      bankChargeDate,
      originalAmount: Math.abs(raw.originalAmount),
      originalCurrency: normalizedOriginalCurrency,
      chargedAmountIls: Math.abs(chargedAmount),
      exchangeRateUsed: exchangeRate,
      paymentType,
      installmentIndex: installmentInfo.currentPayment,
      installmentTotal: installmentInfo.totalPayments,
      isRefund,
      isSubscription,
      sourceFileName: '', // Will be set in parse()
      bankCategory: raw.category || null,
      notes: this.buildNotes(raw),
      rawRow: raw,
    };
  }

  private parseMaxDate(dateStr: string): Date {
    const match = dateStr.match(REGEX_PATTERNS.date);
    if (!match) {
      throw new Error(`Invalid MAX date format: ${dateStr}`);
    }

    const [, day, month, year] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  private parseExchangeRate(rateStr: string): number | undefined {
    if (!rateStr || rateStr.trim() === '') return undefined;

    const cleaned = rateStr.trim();
    const rate = parseFloat(cleaned);

    return isNaN(rate) ? undefined : rate;
  }

  private parseInstallment(
    notes: string,
    transactionType: string
  ): {
    isInstallment: boolean;
    currentPayment?: number;
    totalPayments?: number;
  } {
    const match = notes.match(REGEX_PATTERNS.installment);

    if (!match && transactionType !== TRANSACTION_TYPES.INSTALLMENTS) {
      return { isInstallment: false };
    }

    if (!match) {
      return { isInstallment: true };
    }

    return {
      isInstallment: true,
      currentPayment: parseInt(match[1], 10),
      totalPayments: parseInt(match[2], 10),
    };
  }

  private determinePaymentType(
    transactionType: string,
    isInstallment: boolean,
    isSubscription: boolean
  ): 'one_time' | 'installments' | 'subscription' {
    // Subscription takes priority over installments
    if (isSubscription) {
      return 'subscription';
    }
    // FIX: Return 'one_time' instead of 'regular', removed 'credit'
    if (transactionType === TRANSACTION_TYPES.INSTALLMENTS || isInstallment) {
      return 'installments';
    }
    return 'one_time';
  }

  private detectSubscription(notes: string, businessName: string, executionMethod: string): boolean {
    // Check notes for "הוראת קבע" (standing order)
    if (REGEX_PATTERNS.subscription.test(notes)) return true;

    // Check known subscription businesses
    const lowerName = businessName.toLowerCase();
    if (SUBSCRIPTION_KEYWORDS.some((kw) => lowerName.includes(kw))) {
      return true;
    }

    return false;
  }

  private normalizeCurrency(currency: string): string {
    const currencyMap: Record<string, string> = {
      '₪': 'ILS',
      $: 'USD',
      '€': 'EUR',
      '¥': 'JPY',
      '': 'ILS',
    };

    return currencyMap[currency] || currency.toUpperCase();
  }

  private cleanBusinessName(name: string): string {
    return name.replace(/\s{2,}/g, ' ').trim();
  }

  private buildNotes(raw: MaxRawTransaction): string | null {
    const parts: string[] = [];

    if (raw.notes) parts.push(raw.notes);
    if (raw.tags) parts.push(`תיוגים: ${raw.tags}`);
    if (raw.discountClub) parts.push(`מועדון הנחות: ${raw.discountClub}`);
    if (raw.executionMethod) parts.push(`אופן ביצוע: ${raw.executionMethod}`);

    return parts.length > 0 ? parts.join(' | ') : null;
  }
}
