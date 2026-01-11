import { createHash } from 'crypto';

export interface TransactionHashInput {
  normalizedBusinessName: string;
  dealDate: string; // YYYY-MM-DD format
  chargedAmountIls: number;
  cardLast4: string;
  installmentIndex?: number;
  paymentType: 'regular' | 'installments' | 'subscription' | 'credit';
  isRefund: boolean;
}

/**
 * Generates a SHA-256 hash for transaction deduplication
 *
 * Hash inputs (concatenated with "|"):
 * - normalized_business_name (lowercase, trimmed)
 * - deal_date (YYYY-MM-DD)
 * - charged_amount_ils (rounded to 2 decimals, absolute value)
 * - card_last_4_digits
 * - installment_index (or "0" if not installment)
 * - payment_type
 * - is_refund (true/false) - distinguishes refunds from charges
 */
export function generateTransactionHash(input: TransactionHashInput): string {
  const {
    normalizedBusinessName,
    dealDate,
    chargedAmountIls,
    cardLast4,
    installmentIndex = 0,
    paymentType,
    isRefund,
  } = input;

  // Round amount to 2 decimals and convert to string
  const amountStr = chargedAmountIls.toFixed(2);

  // Concatenate with separator - include isRefund to distinguish charges from refunds
  const hashInput = `${normalizedBusinessName}|${dealDate}|${amountStr}|${cardLast4}|${installmentIndex}|${paymentType}|${isRefund}`;

  // Generate SHA-256 hash
  return createHash('sha256').update(hashInput, 'utf8').digest('hex');
}

// Installment group ID (parent hash) - links all payments in a single purchase
export interface InstallmentGroupInput {
  businessNormalizedName: string;
  totalPaymentSum: number; // Full purchase amount (e.g., 1200 for 12x100)
  installmentTotal: number; // Number of payments (e.g., 12)
  dealDate: string; // Purchase date YYYY-MM-DD
}

/**
 * Generates installment group ID - same for all payments in a purchase
 * Independent of card (allows card transfers mid-installment)
 */
export function generateInstallmentGroupId(input: InstallmentGroupInput): string {
  const { businessNormalizedName, totalPaymentSum, installmentTotal, dealDate } = input;

  const totalStr = totalPaymentSum.toFixed(2);

  const hashInput = `${businessNormalizedName}|${totalStr}|${installmentTotal}|${dealDate}`;

  return createHash('sha256').update(hashInput, 'utf8').digest('hex');
}

// Individual installment transaction hash (child hash) - unique per payment
export interface InstallmentTransactionHashInput {
  installmentGroupId: string; // Parent hash
  installmentIndex: number; // 1, 2, 3...
}

/**
 * Generates unique hash for a specific installment payment
 * Combines group ID + index
 */
export function generateInstallmentTransactionHash(input: InstallmentTransactionHashInput): string {
  const { installmentGroupId, installmentIndex } = input;

  const hashInput = `${installmentGroupId}|${installmentIndex}`;

  return createHash('sha256').update(hashInput, 'utf8').digest('hex');
}