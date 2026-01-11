import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  generateInstallmentGroupId,
  generateInstallmentTransactionHash,
} from '@/lib/utils/hash';

interface InstallmentInfo {
  index: number; // Current payment number (1, 2, 3...)
  total: number; // Total payments (12, 6, etc.)
  amount: number; // Per-payment amount
}

interface CreateInstallmentGroupParams {
  firstTransactionData: {
    businessId: number;
    businessNormalizedName: string;
    cardId: number;
    dealDate: string; // YYYY-MM-DD
    originalAmount: number;
    originalCurrency: string;
    exchangeRateUsed: number | null;
    chargedAmountIls: number;
    sourceFile: string;
    uploadBatchId: number;
  };
  installmentInfo: InstallmentInfo;
}

/**
 * Creates a full installment group:
 * - Calculates group ID (parent hash)
 * - Inserts the first completed payment
 * - Generates N-1 projected future payments
 */
export async function createInstallmentGroup(params: CreateInstallmentGroupParams) {
  const { firstTransactionData, installmentInfo } = params;
  const { index, total, amount } = installmentInfo;

  // Calculate total purchase amount
  const totalPaymentSum = amount * total;

  // Generate group ID (parent hash)
  const groupId = generateInstallmentGroupId({
    businessNormalizedName: firstTransactionData.businessNormalizedName,
    totalPaymentSum,
    installmentTotal: total,
    dealDate: firstTransactionData.dealDate,
  });

  // Calculate hash for first payment
  const firstPaymentHash = generateInstallmentTransactionHash({
    installmentGroupId: groupId,
    installmentIndex: index,
  });

  // Insert first payment (completed)
  const [firstPayment] = await db
    .insert(transactions)
    .values({
      transactionHash: firstPaymentHash,
      transactionType: 'installment',
      businessId: firstTransactionData.businessId,
      cardId: firstTransactionData.cardId,
      dealDate: firstTransactionData.dealDate,
      originalAmount: firstTransactionData.originalAmount.toString(),
      originalCurrency: firstTransactionData.originalCurrency,
      exchangeRateUsed: firstTransactionData.exchangeRateUsed?.toString() || null,
      chargedAmountIls: firstTransactionData.chargedAmountIls.toString(),
      paymentType: 'installments',
      installmentGroupId: groupId,
      installmentIndex: index,
      installmentTotal: total,
      status: 'completed',
      actualChargeDate: firstTransactionData.dealDate,
      sourceFile: firstTransactionData.sourceFile,
      uploadBatchId: firstTransactionData.uploadBatchId,
    })
    .returning();

  // Generate projected payments (index+1 through total)
  const projectedPayments = [];
  for (let i = index + 1; i <= total; i++) {
    // Calculate projected date: deal_date + (i - index) * 30 days
    const dealDateObj = new Date(firstTransactionData.dealDate);
    const projectedDate = new Date(dealDateObj);
    projectedDate.setDate(projectedDate.getDate() + (i - index) * 30);
    const projectedDateStr = projectedDate.toISOString().split('T')[0];

    // Calculate hash for this installment
    const hash = generateInstallmentTransactionHash({
      installmentGroupId: groupId,
      installmentIndex: i,
    });

    projectedPayments.push({
      transactionHash: hash,
      transactionType: 'installment' as const,
      businessId: firstTransactionData.businessId,
      cardId: firstTransactionData.cardId,
      dealDate: firstTransactionData.dealDate, // Original purchase date
      originalAmount: firstTransactionData.originalAmount.toString(),
      originalCurrency: firstTransactionData.originalCurrency,
      exchangeRateUsed: firstTransactionData.exchangeRateUsed?.toString() || null,
      chargedAmountIls: amount.toString(), // Expected payment amount
      paymentType: 'installments' as const,
      installmentGroupId: groupId,
      installmentIndex: i,
      installmentTotal: total,
      status: 'projected' as const,
      projectedChargeDate: projectedDateStr,
      sourceFile: firstTransactionData.sourceFile,
      uploadBatchId: firstTransactionData.uploadBatchId,
    });
  }

  // Batch insert projected payments
  if (projectedPayments.length > 0) {
    await db.insert(transactions).values(projectedPayments);
  }

  return {
    groupId,
    firstPaymentId: firstPayment.id,
    projectedCount: projectedPayments.length,
  };
}

/**
 * Matches an incoming installment payment to an existing projected transaction
 * Returns the matched transaction if found, null otherwise
 */
export async function matchInstallmentPayment(transactionHash: string) {
  const [existingTransaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.transactionHash, transactionHash))
    .limit(1);

  return existingTransaction || null;
}

/**
 * Updates a projected installment to completed status
 */
export async function completeProjectedInstallment(
  transactionId: number,
  actualData: {
    actualChargeDate: string; // YYYY-MM-DD
    chargedAmountIls: number;
    exchangeRateUsed?: number | null;
  }
) {
  const [updated] = await db
    .update(transactions)
    .set({
      status: 'completed',
      actualChargeDate: actualData.actualChargeDate,
      chargedAmountIls: actualData.chargedAmountIls.toString(),
      exchangeRateUsed: actualData.exchangeRateUsed?.toString() || null,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId))
    .returning();

  // Log warning if amount differs by >5%
  // Note: installmentAmount is stored as string in schema, need to parse
  const projectedStr = updated.chargedAmountIls;
  const projected = parseFloat(projectedStr);
  const actual = actualData.chargedAmountIls;
  const discrepancy = Math.abs(actual - projected) / projected;

  if (discrepancy > 0.05) {
    console.warn(
      `[Installment] Amount discrepancy: expected ${projected.toFixed(2)}, got ${actual.toFixed(2)} (${(discrepancy * 100).toFixed(1)}% difference)`
    );
  }

  return updated;
}

/**
 * Creates installment group starting from a middle payment (backfill missing payments)
 * Use case: User starts tracking mid-installment (e.g., payment 4/36)
 */
export async function createInstallmentGroupFromMiddle(params: CreateInstallmentGroupParams) {
  const { firstTransactionData, installmentInfo } = params;
  const { index: currentIndex, total, amount } = installmentInfo;

  // Calculate total purchase amount
  const totalPaymentSum = amount * total;

  // Generate group ID (parent hash)
  const groupId = generateInstallmentGroupId({
    businessNormalizedName: firstTransactionData.businessNormalizedName,
    totalPaymentSum,
    installmentTotal: total,
    dealDate: firstTransactionData.dealDate,
  });

  const allPayments = [];

  // STEP 1: Backfill past payments (1 to currentIndex-1) as completed
  for (let i = 1; i < currentIndex; i++) {
    // Calculate charge date for payment i: original date + (i - 1) * 30 days
    const dealDateObj = new Date(firstTransactionData.dealDate);
    const chargeDate = new Date(dealDateObj);
    chargeDate.setDate(chargeDate.getDate() + (i - 1) * 30);
    const chargeDateStr = chargeDate.toISOString().split('T')[0];

    const hash = generateInstallmentTransactionHash({
      installmentGroupId: groupId,
      installmentIndex: i,
    });

    allPayments.push({
      transactionHash: hash,
      transactionType: 'installment' as const,
      businessId: firstTransactionData.businessId,
      cardId: firstTransactionData.cardId,
      dealDate: firstTransactionData.dealDate, // Original purchase date
      originalAmount: firstTransactionData.originalAmount.toString(),
      originalCurrency: firstTransactionData.originalCurrency,
      exchangeRateUsed: firstTransactionData.exchangeRateUsed?.toString() || null,
      chargedAmountIls: amount.toString(),
      paymentType: 'installments' as const,
      installmentGroupId: groupId,
      installmentIndex: i,
      installmentTotal: total,
      status: 'completed' as const, // Mark as completed (backfilled)
      actualChargeDate: chargeDateStr, // Calculated charge date
      sourceFile: firstTransactionData.sourceFile,
      uploadBatchId: firstTransactionData.uploadBatchId,
    });
  }

  // STEP 2: Insert current payment (from upload)
  const currentHash = generateInstallmentTransactionHash({
    installmentGroupId: groupId,
    installmentIndex: currentIndex,
  });

  // Calculate charge date for current payment: original date + (currentIndex - 1) * 30 days
  const currentDealDateObj = new Date(firstTransactionData.dealDate);
  const currentChargeDate = new Date(currentDealDateObj);
  currentChargeDate.setDate(currentChargeDate.getDate() + (currentIndex - 1) * 30);
  const currentChargeDateStr = currentChargeDate.toISOString().split('T')[0];

  allPayments.push({
    transactionHash: currentHash,
    transactionType: 'installment' as const,
    businessId: firstTransactionData.businessId,
    cardId: firstTransactionData.cardId,
    dealDate: firstTransactionData.dealDate,
    originalAmount: firstTransactionData.originalAmount.toString(),
    originalCurrency: firstTransactionData.originalCurrency,
    exchangeRateUsed: firstTransactionData.exchangeRateUsed?.toString() || null,
    chargedAmountIls: firstTransactionData.chargedAmountIls.toString(),
    paymentType: 'installments' as const,
    installmentGroupId: groupId,
    installmentIndex: currentIndex,
    installmentTotal: total,
    status: 'completed' as const,
    actualChargeDate: currentChargeDateStr,
    sourceFile: firstTransactionData.sourceFile,
    uploadBatchId: firstTransactionData.uploadBatchId,
  });

  // STEP 3: Create projected future payments (currentIndex+1 to total)
  for (let i = currentIndex + 1; i <= total; i++) {
    // Calculate projected charge date: original date + (i - 1) * 30 days
    const dealDateObj = new Date(firstTransactionData.dealDate);
    const projectedDate = new Date(dealDateObj);
    projectedDate.setDate(projectedDate.getDate() + (i - 1) * 30);
    const projectedDateStr = projectedDate.toISOString().split('T')[0];

    const hash = generateInstallmentTransactionHash({
      installmentGroupId: groupId,
      installmentIndex: i,
    });

    allPayments.push({
      transactionHash: hash,
      transactionType: 'installment' as const,
      businessId: firstTransactionData.businessId,
      cardId: firstTransactionData.cardId,
      dealDate: firstTransactionData.dealDate,
      originalAmount: firstTransactionData.originalAmount.toString(),
      originalCurrency: firstTransactionData.originalCurrency,
      exchangeRateUsed: firstTransactionData.exchangeRateUsed?.toString() || null,
      chargedAmountIls: amount.toString(),
      paymentType: 'installments' as const,
      installmentGroupId: groupId,
      installmentIndex: i,
      installmentTotal: total,
      status: 'projected' as const,
      projectedChargeDate: projectedDateStr,
      sourceFile: firstTransactionData.sourceFile,
      uploadBatchId: firstTransactionData.uploadBatchId,
    });
  }

  // Batch insert all payments
  await db.insert(transactions).values(allPayments);

  return {
    groupId,
    backfilledCount: currentIndex - 1,
    currentPaymentIndex: currentIndex,
    projectedCount: total - currentIndex,
    totalCreated: total,
  };
}

/**
 * Check if any transaction exists in the given installment group
 */
export async function findAnyTransactionInGroup(groupId: string) {
  const [existing] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.installmentGroupId, groupId))
    .limit(1);

  return existing || null;
}
