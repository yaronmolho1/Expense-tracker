/**
 * Base Parser Interface
 * All bank statement parsers must implement this interface
 */

export interface ParsedTransaction {
  // Business
  businessName: string;           // Raw merchant name (will be normalized later)

  // Dates
  dealDate: Date;                 // Purchase/transaction date
  bankChargeDate?: Date;          // When bank actually posted the charge

  // Amounts
  originalAmount: number;         // Amount in original currency
  originalCurrency: string;       // ISO 4217: "ILS", "USD", "EUR", "JPY"
  chargedAmountIls: number;      // Final amount charged in ILS
  exchangeRateUsed?: number;     // Exchange rate applied (if foreign currency)

  // Payment type
  paymentType: 'one_time' | 'installments' | 'subscription';

  // Installment info (optional, only if paymentType = 'installments')
  installmentIndex?: number;      // Current payment number (1-based)
  installmentTotal?: number;      // Total number of payments

  // Flags
  isRefund: boolean;             // Negative amount or cancellation
  isSubscription: boolean;       // Recurring payment (הוראת קבע, etc.)

  // Metadata
  sourceFileName: string;        // Original Excel filename
  bankCategory?: string | null;  // Optional bank-provided category
  notes?: string | null;         // Additional notes from statement
  rawRow?: unknown;              // For debugging
}

export interface ParserMetadata {
  cardLast4: string;              // Last 4 digits of card
  accountNumber?: string;         // Bank account number if available
  statementMonth: string;         // e.g., "07/2025" or "יולי 2025"
  statementDate?: Date;           // Billing date if available
  totalAmount?: number;           // Total amount for the month (validation)
}

export interface ValidationResult {
  expectedTotal?: number;      // From file header
  calculatedTotal: number;      // SUM(transactions)
  difference: number;           // expectedTotal - calculatedTotal
  isValid: boolean;             // difference <= tolerance
  tolerance: number;            // ±10 ILS for dev
}

export interface ParserResult {
  metadata: ParserMetadata;
  transactions: ParsedTransaction[];
  errors?: ParseError[];
  warnings?: ParseWarning[];
  validation?: ValidationResult;
}

export interface ParseError {
  row: number;
  message: string;
  data?: any;
}

export interface ParseWarning {
  row: number;
  message: string;
  data?: any;
}

/**
 * Abstract base class for all parsers
 */
export abstract class BaseParser {
  protected fileName: string;

  constructor(fileName: string) {
    this.fileName = fileName;
  }

  /**
   * Main parsing method - must be implemented by each parser
   * @param filePath - Absolute path to the Excel file
   * @returns ParserResult with transactions, metadata, errors, and warnings
   */
  abstract parse(filePath: string): Promise<ParserResult>;

  /**
   * Validate if this parser can handle the given file
   * @param filePath - Absolute path to the Excel file
   * @returns true if this parser can handle the file
   */
  abstract canParse(filePath: string): Promise<boolean>;

  /**
   * Get parser name/identifier
   */
  abstract getName(): string;
}

/**
 * Helper: Calculate and validate total amount
 */
export function validateTransactionTotal(
  transactions: ParsedTransaction[],
  expectedTotal?: number,
  tolerance: number = 10
): ValidationResult {
  const calculatedTotal = transactions.reduce(
    (sum, txn) => sum + txn.chargedAmountIls,
    0
  );

  const difference = expectedTotal
    ? Math.abs(expectedTotal - calculatedTotal)
    : 0;

  return {
    expectedTotal,
    calculatedTotal,
    difference,
    isValid: !expectedTotal || difference <= tolerance,
    tolerance,
  };
}
