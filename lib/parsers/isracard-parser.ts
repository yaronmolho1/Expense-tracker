/**
 * Isracard/AMEX Parser
 * Handles both Isracard and AMEX credit card statement formats
 *
 * File format: Single sheet "פירוט עסקאות" with multiple transaction sections
 * Expected sections:
 * 1. עסקאות למועד חיוב (Regular billing)
 * 2. עסקאות בחיוב מחוץ למועד (Immediate billing - foreign/online)
 * 3. עסקאות בחיוב עתידי (Future billing - optional, text only)
 * 4. עסקאות בחיוב מיידי (Immediate charges - ATM, etc. - optional)
 */

import * as XLSX from 'xlsx';
import { BaseParser, ParserResult, ParsedTransaction, ParserMetadata, ParseError, ParseWarning, validateTransactionTotal } from './base-parser';

// ============================================
// TYPES
// ============================================

// Type for Excel worksheet data - array of rows, where each row is an array of cell values
type ExcelRow = (string | number | boolean | Date | null | undefined)[];
type ExcelData = ExcelRow[];

interface IsracardMetadata {
  cardLast4: string;
  cardType: string;
  statementMonth: string;
  statementYear: number;
  chargeDate?: Date;
  totalAmount?: number;
  cardholderName?: string;
}

interface SectionBounds {
  section1Start?: number;
  section1End?: number;
  section2Start?: number;
  section2End?: number;
  section3Start?: number;
  section3End?: number;
  section4Start?: number;
  section4End?: number;
}

// ============================================
// CONSTANTS
// ============================================

const REGEX_PATTERNS = {
  cardNumber: /-\s*(\d{4})/,
  chargeDate: /ב-(\d{1,2})\.(\d{1,2})/,
  installment: /תשלום\s+(\d+)\s+מתוך\s+(\d+)/,
  finalInstallment: /תשלום אחרון/,
  date: /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/,
  subscription: /הוראת קבע/,
  foreignPhysical: /בוצע בחו"ל/,
  foreignWebsite: /אתר חו"ל/,
  discount: /הנחה/,
  refund: /זיכוי|החזר|ביטול/,
};

const CURRENCY_MAP: Record<string, string> = {
  '₪': 'ILS',
  '$': 'USD',
  '€': 'EUR',
  '¥': 'JPY',
};

const SECTION_HEADERS = {
  REGULAR: 'עסקאות למועד חיוב',
  FOREIGN: 'עסקאות בחיוב מחוץ למועד',
  FUTURE: 'עסקאות בחיוב עתידי',
  IMMEDIATE: 'עסקאות בחיוב מיידי',
};

const COLUMN_INDICES = {
  DEAL_DATE: 0,        // A
  BUSINESS_NAME: 1,    // B
  ORIGINAL_AMOUNT: 2,  // C
  ORIGINAL_CURRENCY: 3,// D
  CHARGED_AMOUNT: 4,   // E
  CHARGED_CURRENCY: 5, // F
  VOUCHER_NUMBER: 6,   // G
  ADDITIONAL_DETAILS: 7,// H
  BANK_CHARGE_DATE: 8  // I (Section 2 only)
};

// ============================================
// MAIN PARSER CLASS
// ============================================

export class IscracardParser extends BaseParser {
  /**
   * Extract card last 4 digits from file header (static method for card detection)
   * @param rows - First 10 rows of the Excel sheet
   * @returns {last4: string} or null if not found
   */
  static extractCardFromHeader(rows: ExcelData): { last4: string } | null {
    // Card number is in row 5 (index 4), pattern: "ישראכרט אמריקן אקספרס - XXXX"
    const row5 = rows[4]?.[0]?.toString() || '';
    const match = row5.match(/-\s*(\d{4})/);
    return match ? { last4: match[1] } : null;
  }

  async canParse(filePath: string): Promise<boolean> {
    try {
      const workbook = XLSX.readFile(filePath);

      // Check if sheet "פירוט עסקאות" exists
      if (!workbook.SheetNames.includes('פירוט עסקאות')) {
        return false;
      }

      const worksheet = workbook.Sheets['פירוט עסקאות'];
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        raw: false,
        defval: ''
      });

      // Validate Row 2 contains "פירוט עסקאות"
      const row2 = rows[1] || [];
      if (!row2[0]?.includes('פירוט עסקאות')) {
        return false;
      }

      // Validate Row 5 contains card info (pattern: "... - XXXX")
      const row5 = rows[4] || [];
      if (!REGEX_PATTERNS.cardNumber.test(row5[0])) {
        return false;
      }

      // Validate section header exists in rows 8-12 (flexible)
      let foundSectionHeader = false;
      for (let i = 7; i <= 12; i++) {
        const row = rows[i] || [];
        if (row[0]?.includes('עסקאות ל')) {
          foundSectionHeader = true;
          break;
        }
      }

      return foundSectionHeader;
    } catch (error) {
      return false;
    }
  }

  async parse(filePath: string): Promise<ParserResult> {
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets['פירוט עסקאות'];

    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
      header: 1,
      raw: false,
      defval: ''
    });

    const errors: ParseError[] = [];
    const warnings: ParseWarning[] = [];
    const transactions: ParsedTransaction[] = [];

    // Extract metadata
    let metadata: IsracardMetadata;
    try {
      metadata = this.extractMetadata(rows);
    } catch (error) {
      throw new Error(`Failed to extract metadata: ${(error as Error).message}`);
    }

    // Detect section bounds
    const bounds = this.detectSectionBounds(rows);
    console.log(`[IscracardParser] Detected bounds for ${this.fileName}:`, JSON.stringify(bounds, null, 2));

    // Parse Section 1 (Regular billing)
    if (bounds.section1Start !== undefined && bounds.section1End !== undefined) {
      const section1Txs = this.parseSection(
        rows,
        bounds.section1Start,
        bounds.section1End,
        'regular',
        metadata,
        errors,
        warnings
      );
      console.log(`[IscracardParser] Section 1 found ${section1Txs.length} transactions`);
      transactions.push(...section1Txs);
    }

    // Parse Section 2 (Foreign/immediate billing)
    if (bounds.section2Start !== undefined && bounds.section2End !== undefined) {
      const section2Txs = this.parseSection(
        rows,
        bounds.section2Start,
        bounds.section2End,
        'foreign',
        metadata,
        errors,
        warnings
      );
      console.log(`[IscracardParser] Section 2 found ${section2Txs.length} transactions`);
      transactions.push(...section2Txs);
    }

    // Parse Section 3 (Future billing)
    if (bounds.section3Start !== undefined && bounds.section3End !== undefined) {
      const section3Txs = this.parseSection(
        rows,
        bounds.section3Start,
        bounds.section3End,
        'regular',
        metadata,
        errors,
        warnings
      );
      console.log(`[IscracardParser] Section 3 found ${section3Txs.length} transactions`);
      transactions.push(...section3Txs);
    }

    // Parse Section 4 (Immediate charges)
    if (bounds.section4Start !== undefined && bounds.section4End !== undefined) {
      const section4Txs = this.parseSection(
        rows,
        bounds.section4Start,
        bounds.section4End,
        'foreign',
        metadata,
        errors,
        warnings
      );
      console.log(`[IscracardParser] Section 4 found ${section4Txs.length} transactions`);
      transactions.push(...section4Txs);
    }

    // Convert to ParserResult format
    const parserMetadata: ParserMetadata = {
      cardLast4: metadata.cardLast4,
      statementMonth: metadata.statementMonth,
      statementDate: metadata.chargeDate,
      totalAmount: metadata.totalAmount,
    };

    // Add validation
    const validation = validateTransactionTotal(
      transactions,
      parserMetadata.totalAmount
    );

    return {
      metadata: parserMetadata,
      transactions,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      validation,
    };
  }

  getName(): string {
    return 'isracard-amex';
  }

  // ============================================
  // METADATA EXTRACTION
  // ============================================

  private extractMetadata(rows: ExcelData): IsracardMetadata {
    // Row 2 (index 1): Statement period
    const periodCell = rows[1]?.[2]?.toString() ?? '';
    const statementMonth = periodCell.trim();

    // Extract year from statement month (e.g., "יולי 2025")
    const yearMatch = statementMonth.match(/(\d{4})/);
    const statementYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    // Search for card number in rows 3-7 (flexible position)
    let cardLast4: string | undefined;
    let cardType = '';
    let totalAmount: number | undefined;
    let cardholderName = '';
    let chargeDate: Date | undefined;

    // Try to find card number in first 10 rows, any column
    for (let rowIdx = 3; rowIdx < Math.min(10, rows.length); rowIdx++) {
      const row = rows[rowIdx] || [];
      for (let colIdx = 0; colIdx < Math.min(10, row.length); colIdx++) {
        const cell = row[colIdx]?.toString() ?? '';
        const cardMatch = cell.match(REGEX_PATTERNS.cardNumber);
        if (cardMatch && !cardLast4) {
          cardLast4 = cardMatch[1];
          cardType = cell.split('-')[0]?.trim() ?? '';

          // Try to get total from same row (usually column 7 or 8)
          const totalCell1 = row[7]?.toString() ?? '';
          const totalCell2 = row[8]?.toString() ?? '';
          totalAmount = this.parseAmount(totalCell1) || this.parseAmount(totalCell2);

          console.log(`[IscracardParser] Found card in row ${rowIdx + 1}, col ${colIdx + 1}: ${cardLast4}`);
          break;
        }
      }
      if (cardLast4) break;
    }

    // Fallback: Search for cardholder name pattern
    for (let rowIdx = 3; rowIdx < Math.min(10, rows.length); rowIdx++) {
      const row = rows[rowIdx] || [];
      for (let colIdx = 0; colIdx < Math.min(5, row.length); colIdx++) {
        const cell = row[colIdx]?.toString() ?? '';
        if (cell.includes('על שם') && !cardholderName) {
          cardholderName = cell.replace('על שם', '').trim();

          // Try to get charge date from same row
          const chargeDateCell1 = row[7]?.toString() ?? '';
          const chargeDateCell2 = row[8]?.toString() ?? '';
          const chargeDateMatch = (chargeDateCell1 + chargeDateCell2).match(REGEX_PATTERNS.chargeDate);
          if (chargeDateMatch) {
            const day = parseInt(chargeDateMatch[1], 10);
            const month = parseInt(chargeDateMatch[2], 10);
            chargeDate = new Date(statementYear, month - 1, day);
          }
          break;
        }
      }
      if (cardholderName) break;
    }

    // If still no card found, throw error
    if (!cardLast4) {
      console.error('[IscracardParser] Failed to find card number. First 10 rows:',
        rows.slice(0, 10).map((r, i) => `Row ${i + 1}: ${r.slice(0, 3).join(' | ')}`));
      throw new Error('Cannot extract card number from file. Please check file format.');
    }

    return {
      cardLast4,
      cardType,
      statementMonth,
      statementYear,
      chargeDate,
      totalAmount,
      cardholderName,
    };
  }

  // ============================================
  // SECTION DETECTION
  // ============================================

  private detectSectionBounds(rows: ExcelData): SectionBounds {
    const bounds: SectionBounds = {};

    for (let i = 0; i < rows.length; i++) {
      const cellA = rows[i]?.[0]?.toString() ?? '';
      const cellB = rows[i]?.[1]?.toString() ?? '';

      // Section 1 start (Regular billing)
      if (cellA.includes(SECTION_HEADERS.REGULAR)) {
        bounds.section1Start = i + 2; // Skip header row
      }

      // Section 2 start (Foreign/immediate billing)
      if (cellA.includes(SECTION_HEADERS.FOREIGN)) {
        if (bounds.section1Start && !bounds.section1End) {
          bounds.section1End = i - 1;
        }
        bounds.section2Start = i + 2;
      }

      // Section 3 start (Future billing) - text-based section
      if (cellA.includes(SECTION_HEADERS.FUTURE)) {
        if (bounds.section2Start && !bounds.section2End) {
          bounds.section2End = i - 1;
        } else if (bounds.section1Start && !bounds.section1End) {
          bounds.section1End = i - 1;
        }
        bounds.section3Start = i + 2;
      }

      // Section 4 start (Immediate charges - ATM, etc.)
      if (cellA.includes(SECTION_HEADERS.IMMEDIATE)) {
        if (bounds.section3Start && !bounds.section3End) {
          bounds.section3End = i - 1;
        } else if (bounds.section2Start && !bounds.section2End) {
          bounds.section2End = i - 1;
        } else if (bounds.section1Start && !bounds.section1End) {
          bounds.section1End = i - 1;
        }
        bounds.section4Start = i + 2;
      }

      // Total row (marks end of current section)
      if (cellB.includes('סה"כ לחיוב החודש') || cellB.includes('סה"כ')) {
        if (bounds.section1Start && !bounds.section1End) {
          bounds.section1End = i - 1;
        } else if (bounds.section2Start && !bounds.section2End) {
          bounds.section2End = i - 1;
        } else if (bounds.section3Start && !bounds.section3End) {
          bounds.section3End = i - 1;
        } else if (bounds.section4Start && !bounds.section4End) {
          bounds.section4End = i - 1;
        }
      }

      // Footer (end of all data)
      if (cellA.includes('תנאים משפטיים')) {
        if (bounds.section4Start && !bounds.section4End) {
          bounds.section4End = i - 1;
        } else if (bounds.section3Start && !bounds.section3End) {
          bounds.section3End = i - 1;
        } else if (bounds.section2Start && !bounds.section2End) {
          bounds.section2End = i - 1;
        } else if (bounds.section1Start && !bounds.section1End) {
          bounds.section1End = i - 1;
        }
      }
    }

    // Finalize section ends if not set
    if (bounds.section1Start && !bounds.section1End) {
      bounds.section1End = bounds.section2Start ? bounds.section2Start - 3 : rows.length - 2;
    }
    if (bounds.section2Start && !bounds.section2End) {
      bounds.section2End = bounds.section3Start ? bounds.section3Start - 3 : rows.length - 2;
    }
    if (bounds.section3Start && !bounds.section3End) {
      bounds.section3End = bounds.section4Start ? bounds.section4Start - 3 : rows.length - 2;
    }
    if (bounds.section4Start && !bounds.section4End) {
      bounds.section4End = rows.length - 2;
    }

    return bounds;
  }

  // ============================================
  // SECTION PARSING
  // ============================================

  private parseSection(
    rows: ExcelData,
    startRow: number,
    endRow: number,
    sectionType: 'regular' | 'foreign',
    metadata: IsracardMetadata,
    errors: ParseError[],
    warnings: ParseWarning[]
  ): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    for (let i = startRow; i <= endRow; i++) {
      const row = rows[i];
      if (!row) continue;

      try {
        const transaction = this.parseTransactionRow(row, i + 1, sectionType, metadata);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        errors.push({
          row: i + 1,
          message: (error as Error).message,
          data: row,
        });
      }
    }

    return transactions;
  }

  // ============================================
  // TRANSACTION ROW PARSING
  // ============================================

  private parseTransactionRow(
    row: ExcelRow,
    rowNumber: number,
    sectionType: 'regular' | 'foreign',
    metadata: IsracardMetadata
  ): ParsedTransaction | null {
    const COL = COLUMN_INDICES;

    // Validate this is a data row
    const dateStr = row[COL.DEAL_DATE]?.toString() ?? '';
    if (!REGEX_PATTERNS.date.test(dateStr)) {
      return null; // Not a transaction row
    }

    const businessName = row[COL.BUSINESS_NAME]?.toString().trim();
    if (!businessName || businessName.includes('סה"כ')) {
      return null; // Header or total row
    }

    // Parse fields
    const dealDate = this.parseDate(dateStr, metadata.statementYear);
    if (!dealDate) {
      throw new Error(`Invalid deal date: ${dateStr}`);
    }

    const originalAmount = this.parseAmount(row[COL.ORIGINAL_AMOUNT]?.toString() ?? '0');
    const originalCurrency = this.parseCurrency(row[COL.ORIGINAL_CURRENCY]?.toString() ?? '');
    const chargedAmount = this.parseAmount(row[COL.CHARGED_AMOUNT]?.toString() ?? '0');
    const chargedCurrency = this.parseCurrency(row[COL.CHARGED_CURRENCY]?.toString() ?? '');
    const voucherNumber = row[COL.VOUCHER_NUMBER]?.toString().trim() ?? '';
    const additionalDetails = row[COL.ADDITIONAL_DETAILS]?.toString() ?? '';

    // Section 2 specific: bank charge date
    let bankChargeDate: Date | undefined;
    if (sectionType === 'foreign' && row[COL.BANK_CHARGE_DATE]) {
      bankChargeDate = this.parseDate(row[COL.BANK_CHARGE_DATE]?.toString() ?? '', metadata.statementYear) ?? undefined;
    }

    // Parse additional details
    const isSubscription = REGEX_PATTERNS.subscription.test(additionalDetails);

    // Only parse installment if NOT a subscription (subscriptions take priority)
    const installmentInfo = isSubscription ? null : this.parseInstallment(additionalDetails);

    const isForeignTransaction = REGEX_PATTERNS.foreignPhysical.test(additionalDetails) ||
                                  REGEX_PATTERNS.foreignWebsite.test(additionalDetails);
    const isWaived = chargedAmount === 0 && REGEX_PATTERNS.discount.test(additionalDetails);
    const isRefund = chargedAmount < 0 || REGEX_PATTERNS.refund.test(additionalDetails);

    // Calculate exchange rate if foreign currency
    let exchangeRate: number | undefined;
    if (originalCurrency !== chargedCurrency && originalAmount > 0) {
      exchangeRate = chargedAmount / originalAmount;
    }

    // Convert charged amount to ILS
    let chargedAmountIls = chargedAmount;
    if (chargedCurrency !== 'ILS') {
      // If charged in foreign currency, we'll need exchange rate service later
      // For now, assume it's already in ILS or use the charged amount
      chargedAmountIls = chargedAmount;
    }

    // Determine payment type (subscription takes priority over installments)
    const paymentType: 'one_time' | 'installments' | 'subscription' =
      isSubscription ? 'subscription' : (installmentInfo ? 'installments' : 'one_time');

    return {
      businessName,
      dealDate,
      bankChargeDate,
      originalAmount: Math.abs(originalAmount),
      originalCurrency,
      chargedAmountIls: Math.abs(chargedAmountIls),
      exchangeRateUsed: exchangeRate,
      paymentType,
      installmentIndex: installmentInfo?.index,
      installmentTotal: installmentInfo?.total,
      isRefund,
      isSubscription,
      sourceFileName: this.fileName,
      bankCategory: null,
      notes: additionalDetails || null,
      rawRow: row,
    };
  }

  // ============================================
  // PARSING UTILITIES
  // ============================================

  private parseDate(dateStr: string, fallbackYear: number): Date | null {
    const match = dateStr.match(REGEX_PATTERNS.date);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);

    // Handle 2-digit year
    if (year < 100) {
      year += 2000;
    }

    // Validate date components
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const date = new Date(year, month - 1, day);

    // Validate date object
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  private parseAmount(amountStr: string): number {
    if (!amountStr) return 0;

    const str = amountStr.toString().trim();

    // Remove currency symbols
    const withoutCurrency = str.replace(/[₪$€¥]/g, '');

    // Remove whitespace
    const withoutSpaces = withoutCurrency.replace(/\s+/g, '');

    // Remove thousands separators (commas)
    const withoutCommas = withoutSpaces.replace(/,/g, '');

    // Parse as float
    const amount = parseFloat(withoutCommas);

    // Validate result
    if (isNaN(amount)) {
      return 0;
    }

    return amount;
  }

  private parseCurrency(currencyStr: string): string {
    const symbol = currencyStr?.trim();
    return CURRENCY_MAP[symbol] || symbol || 'ILS';
  }

  private parseInstallment(text: string): { index: number; total: number; isFinal: boolean } | null {
    if (!text) return null;

    const match = text.match(REGEX_PATTERNS.installment);
    if (!match) return null;

    const index = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    const isFinal = REGEX_PATTERNS.finalInstallment.test(text) || index === total;

    // Validation
    if (index < 1 || index > total) {
      throw new Error(`Invalid installment: ${index}/${total}`);
    }

    return { index, total, isFinal };
  }
}
