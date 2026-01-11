import * as XLSX from 'xlsx';
import { BaseParser, ParserResult, ParsedTransaction, ParserMetadata, validateTransactionTotal } from './base-parser';
import path from 'path';

/**
 * VISA/CAL Parser for Discount Bank (דיסקונט) statements
 * Format: .xlsx with Hebrew text
 * See: /docs/VISA-CAL-PARSER-SPEC.md
 */

// ============================================
// TYPES
// ============================================

interface VisaCalMetadata {
  cardLast4: string;
  accountNumber: string;
  chargeDate: Date;
  chargeTotalILS: number;
  immediateChargeTotalILS?: number;
}

interface AmountParseResult {
  amount: number;
  currency: string;
}

// ============================================
// CONSTANTS
// ============================================

const REGEX_PATTERNS = {
  cardLast4: /המסתיים ב-(\d{4})/,
  accountNumber: /דיסקונט לישראל ([\d-]+)/,
  chargeDate: /לחיוב ב-(\d{1,2}\/\d{1,2}\/\d{4})/,
  chargeTotal: /:\s*([\d,]+\.\d{2})\s*₪/,
  immediateCharge: /עסקאות בחיוב מיידי\s*([\d,]+\.\d{2})\s*₪/,
  installment: /תשלום\s+(\d+)\s+מתוך\s+(\d+)/,
  amount: /([$₪]|[A-Z]{3})\s*(-?[\d,]+\.?\d*)/,
  footer: /את המידע המלא על כל עסקה/,
  statementMonth: /(\d{2})\.(\d{2})\.(\d{2})/,  // DD.MM.YY format in filename
};

const HEADER_INDICATORS = ['תאריך', 'בית עסק', 'סכום'];

const TRANSACTION_TYPES = {
  REGULAR: 'רגילה',
  INSTALLMENTS: 'תשלומים',
  REFUND: 'זיכוי',
} as const;

const SUBSCRIPTION_KEYWORDS = [
  'הוראת קבע',
  'מנוי',
  'חודשי',
  'subscription',
  'netflix',
  'spotify',
  'apple',
  'google',
  'microsoft',
  'amazon prime',
  'youtube premium',
];

// ============================================
// MAIN PARSER CLASS
// ============================================

export class VisaCalParser extends BaseParser {
  /**
   * Extract card last 4 digits from file header (static method for card detection)
   * @param rows - First 10 rows of the Excel sheet
   * @returns {last4: string} or null if not found
   */
  static extractCardFromHeader(rows: string[][]): { last4: string } | null {
    // Card number is in row 0 (index 0), pattern: "המסתיים ב-XXXX"
    const row0 = rows[0]?.[0] || '';
    const match = row0.match(/המסתיים ב-(\d{4})/);
    return match ? { last4: match[1] } : null;
  }

  constructor(fileName: string) {
    super(fileName);
  }

  /**
   * Detect if this parser can handle the given file
   */
  async canParse(filePath: string): Promise<boolean> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];

      // Check 1: Sheet name must contain "דיסקונט"
      if (!sheetName.includes('דיסקונט')) return false;

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, {
        header: 1,
        raw: false,
        defval: '',
      });

      // Check 2: Row 0 must contain VISA card pattern
      const row0 = rows[0]?.[0] || '';
      if (!row0.includes('ויזה') || !row0.includes('המסתיים')) return false;

      // Check 3: Must have valid header row
      if (!this.isValidHeader(rows[3]) && !this.isValidHeader(rows[4])) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Main parsing method
   */
  async parse(filePath: string): Promise<ParserResult> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to array of arrays
      const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, {
        header: 1,
        raw: false,
        defval: '',
      });

      // Extract metadata
      const metadata = this.extractMetadata(rows);

      // Find header row
      const headerRowIndex = this.findHeaderRow(rows);

      // Parse transactions
      const transactions = this.parseTransactions(rows, worksheet, headerRowIndex, metadata);

      // Build ParserResult
      const parserMetadata = {
        cardLast4: metadata.cardLast4,
        accountNumber: metadata.accountNumber,
        statementMonth: this.extractStatementMonth(this.fileName, metadata.chargeDate),
        statementDate: metadata.chargeDate,
        totalAmount: metadata.chargeTotalILS,
      };

      const validation = validateTransactionTotal(
        transactions,
        parserMetadata.totalAmount
      );

      return {
        metadata: parserMetadata,
        transactions,
        errors: [],
        warnings: [],
        validation,
      };
    } catch (error) {
      return {
        metadata: {
          cardLast4: 'unknown',
          statementMonth: 'unknown',
        },
        transactions: [],
        errors: [
          {
            row: 0,
            message: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  getName(): string {
    return 'visa-cal';
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private isValidHeader(row: string[] | undefined): boolean {
    if (!row) return false;
    return HEADER_INDICATORS.every((indicator) =>
      row.some((cell) => cell.includes(indicator))
    );
  }

  private extractStatementMonth(fileName: string, chargeDate: Date): string {
    // Try to extract from filename first
    const match = fileName.match(REGEX_PATTERNS.statementMonth);
    if (match) {
      const [, day, month, year] = match;
      return `${month}/20${year}`;
    }

    // Fallback to charge date
    const month = String(chargeDate.getMonth() + 1).padStart(2, '0');
    const year = chargeDate.getFullYear();
    return `${month}/${year}`;
  }

  private extractMetadata(rows: string[][]): VisaCalMetadata {
    const row0 = rows[0]?.[0] || '';
    const row2 = rows[2]?.[0] || '';
    const row3 = rows[3]?.[0] || '';

    // Extract card last 4 digits
    const cardMatch = row0.match(REGEX_PATTERNS.cardLast4);
    if (!cardMatch) {
      throw new Error('Cannot extract card last 4 digits from row 0');
    }

    // Extract account number
    const accountMatch = row0.match(REGEX_PATTERNS.accountNumber);
    if (!accountMatch) {
      throw new Error('Cannot extract account number from row 0');
    }

    // Extract charge date
    const chargeDateMatch = row2.match(REGEX_PATTERNS.chargeDate);
    if (!chargeDateMatch) {
      throw new Error('Cannot extract charge date from row 2');
    }

    // Extract charge total
    const chargeTotalMatch = row2.match(REGEX_PATTERNS.chargeTotal);
    if (!chargeTotalMatch) {
      throw new Error('Cannot extract charge total from row 2');
    }

    // Check for immediate charge total (row 3)
    const immediateTotalMatch = row3.match(REGEX_PATTERNS.immediateCharge);

    return {
      cardLast4: cardMatch[1],
      accountNumber: accountMatch[1],
      chargeDate: this.parseIsraeliDate(chargeDateMatch[1]),
      chargeTotalILS: parseFloat(chargeTotalMatch[1].replace(/,/g, '')),
      immediateChargeTotalILS: immediateTotalMatch
        ? parseFloat(immediateTotalMatch[1].replace(/,/g, ''))
        : undefined,
    };
  }

  private findHeaderRow(rows: string[][]): number {
    // Check row 3 first
    if (this.isValidHeader(rows[3])) return 3;

    // Check row 4 (if row 3 was immediate charge notice)
    if (this.isValidHeader(rows[4])) return 4;

    throw new Error('Cannot find header row (expected row 3 or 4)');
  }

  private parseTransactions(
    rows: string[][],
    worksheet: XLSX.WorkSheet,
    headerRowIndex: number,
    metadata: VisaCalMetadata
  ): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    let emptyRowCount = 0;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];

      // Check termination conditions
      if (this.isFooterRow(row)) break;

      if (this.isEmptyRow(row)) {
        emptyRowCount++;
        if (emptyRowCount >= 2) break;
        continue;
      }

      emptyRowCount = 0;

      // Parse single transaction
      const transaction = this.parseTransaction(row, worksheet, i, metadata);
      transactions.push(transaction);
    }

    return transactions;
  }

  private parseTransaction(
    row: string[],
    worksheet: XLSX.WorkSheet,
    rowIndex: number,
    metadata: VisaCalMetadata
  ): ParsedTransaction {
    // Get raw cells for date parsing
    const dateCell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: 0 })];
    const dealDate = this.parseExcelDate(dateCell?.v);

    const businessName = row[1]?.trim() || '';
    const transactionType = (row[4] || 'רגילה') as typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];
    const bankCategory = row[5]?.trim() || null;
    const notes = row[6]?.trim() || null;

    // Parse amounts
    const transactionAmountParsed = this.parseAmount(row[2]);
    const chargedAmountParsed = this.parseAmount(row[3]);

    // Parse installment info
    const installmentInfo = this.parseInstallment(notes);

    // Detect subscription first (takes priority)
    const isSubscription = this.detectSubscription(notes, businessName);

    // Determine payment type (subscription takes priority over installments)
    const paymentType = this.determinePaymentType(transactionType, installmentInfo.isInstallment, isSubscription);

    // Check if foreign currency
    const isForeignCurrency = transactionAmountParsed.currency !== 'ILS';
    const exchangeRate = isForeignCurrency
      ? chargedAmountParsed.amount / transactionAmountParsed.amount
      : undefined;

    // Determine if refund
    const isRefund = transactionType === TRANSACTION_TYPES.REFUND || transactionAmountParsed.amount < 0;

    return {
      // Business
      businessName,

      // Dates
      dealDate,
      bankChargeDate: metadata.chargeDate,

      // Amounts
      originalAmount: Math.abs(transactionAmountParsed.amount),
      originalCurrency: transactionAmountParsed.currency,
      chargedAmountIls: Math.abs(chargedAmountParsed.amount),
      exchangeRateUsed: exchangeRate,

      // Payment type
      paymentType,

      // Installment info
      installmentIndex: installmentInfo.currentPayment,
      installmentTotal: installmentInfo.totalPayments,

      // Flags
      isRefund,
      isSubscription,

      // Metadata
      sourceFileName: this.fileName,
      bankCategory,
      notes,
      rawRow: row,
    };
  }

  // ============================================
  // PARSING UTILITIES
  // ============================================

  /**
   * Parse Excel date (serial number or string)
   */
  private parseExcelDate(value: number | string | undefined): Date {
    if (value === undefined) {
      throw new Error('Date value is undefined');
    }

    if (typeof value === 'number') {
      // Excel serial date (days since Dec 30, 1899)
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + value * 86400000);
    }

    // Fallback: parse Israeli date format "D/M/YY"
    return this.parseIsraeliDate(value);
  }

  /**
   * Parse Israeli date format: D/M/YY or D/M/YYYY
   */
  private parseIsraeliDate(dateStr: string): Date {
    const parts = dateStr.split('/').map(Number);
    if (parts.length !== 3) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }

    const [day, month, yearShort] = parts;
    const year = yearShort < 100 ? 2000 + yearShort : yearShort;

    return new Date(year, month - 1, day);
  }

  /**
   * Parse amount with currency detection
   */
  private parseAmount(value: string | number | undefined): AmountParseResult {
    if (value === undefined || value === '') {
      return { amount: 0, currency: 'ILS' };
    }

    if (typeof value === 'number') {
      return { amount: value, currency: 'ILS' };
    }

    // Remove thousands separator and trim
    const cleaned = value.replace(/,/g, '').trim();

    // Match currency + amount
    const match = cleaned.match(REGEX_PATTERNS.amount);
    if (!match) {
      throw new Error(`Cannot parse amount: ${value}`);
    }

    const currencySymbol = match[1];
    const amount = parseFloat(match[2]);

    // Map currency symbols
    const currency = this.mapCurrency(currencySymbol);

    return { amount, currency };
  }

  private mapCurrency(symbol: string): string {
    switch (symbol) {
      case '₪':
        return 'ILS';
      case '$':
        return 'USD';
      default:
        // Assume it's already a currency code (e.g., 'JPY', 'EUR')
        return symbol;
    }
  }

  /**
   * Parse installment info from notes
   */
  private parseInstallment(notes: string | null): {
    isInstallment: boolean;
    currentPayment?: number;
    totalPayments?: number;
  } {
    if (!notes) return { isInstallment: false };

    const match = notes.match(REGEX_PATTERNS.installment);
    if (!match) return { isInstallment: false };

    return {
      isInstallment: true,
      currentPayment: parseInt(match[1], 10),
      totalPayments: parseInt(match[2], 10),
    };
  }

  /**
   * Determine payment type based on transaction type and installment info
   */
  private determinePaymentType(
    transactionType: string,
    isInstallment: boolean,
    isSubscription: boolean
  ): 'one_time' | 'installments' | 'subscription' {
    // Subscription takes priority
    if (isSubscription) {
      return 'subscription';
    }
    if (transactionType === TRANSACTION_TYPES.INSTALLMENTS || isInstallment) {
      return 'installments';
    }
    return 'one_time';
  }

  /**
   * Detect if transaction is a subscription
   */
  private detectSubscription(notes: string | null, businessName: string): boolean {
    const text = `${notes || ''} ${businessName}`.toLowerCase();
    return SUBSCRIPTION_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
  }

  // ============================================
  // VALIDATION UTILITIES
  // ============================================

  private isEmptyRow(row: string[] | undefined): boolean {
    return !row || row.every((cell) => !cell || cell.trim() === '');
  }

  private isFooterRow(row: string[] | undefined): boolean {
    if (!row || !row[0]) return false;
    return REGEX_PATTERNS.footer.test(row[0]);
  }
}
