import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { eq, and, like, not, sql } from 'drizzle-orm';
import { randomUUID, createHash } from 'node:crypto';
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

  // Generate base group ID (parent hash)
  const baseGroupId = generateInstallmentGroupId({
    businessNormalizedName: firstTransactionData.businessNormalizedName,
    totalPaymentSum,
    installmentTotal: total,
    dealDate: firstTransactionData.dealDate,
  });

  // CRITICAL: Check for collision during backfill
  // If this group ID already exists, generate a unique suffix to avoid duplicate key errors
  let groupId = baseGroupId;
  const existingGroup = await findAnyTransactionInGroup(baseGroupId);
  
  if (existingGroup) {
    // Collision detected! Another identical backfill is in progress
    // Generate unique ID by re-hashing base + UUID to ensure it fits in varchar(64)
    // CRITICAL: We must re-hash instead of concatenating to avoid exceeding column limit
    // Formula: SHA256(baseGroupId + UUID) = guaranteed 64 chars
    const uniqueId = randomUUID();
    groupId = createHash('sha256')
      .update(baseGroupId + uniqueId)
      .digest('hex');
    
    console.log(`[Backfill Collision] Group ID ${baseGroupId.slice(0, 8)} exists. Re-hashed with UUID: ${groupId.slice(0, 16)}`);
  }

  const allPayments = [];

  // STEP 1: Backfill past payments (1 to currentIndex-1) as completed
  // CRITICAL: Calculate Payment 1 amount accurately (handles rounding variance)
  // Payment 1 = Total - (Regular Payment × (N-1))
  // Example: 3099 = 132 + (129 × 23)
  const payment1Amount = totalPaymentSum - (amount * (total - 1));
  
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

    // Use calculated Payment 1 amount for index 1, regular amount for others
    const paymentAmount = i === 1 ? payment1Amount : amount;

    allPayments.push({
      transactionHash: hash,
      transactionType: 'installment' as const,
      businessId: firstTransactionData.businessId,
      cardId: firstTransactionData.cardId,
      dealDate: firstTransactionData.dealDate, // Original purchase date
      originalAmount: firstTransactionData.originalAmount.toString(),
      originalCurrency: firstTransactionData.originalCurrency,
      exchangeRateUsed: firstTransactionData.exchangeRateUsed?.toString() || null,
      chargedAmountIls: paymentAmount.toString(),
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

/**
 * Find completed Payment 1 by exact group ID
 * Used to detect if the standard hash is already occupied
 */
export async function findCompletedPayment1(groupId: string) {
  const expectedHash = generateInstallmentTransactionHash({
    installmentGroupId: groupId,
    installmentIndex: 1,
  });

  const [payment1] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.transactionHash, expectedHash),
        eq(transactions.status, 'completed')
      )
    )
    .limit(1);

  return payment1 || null;
}

/**
 * Check if this EXACT transaction already exists (for idempotency)
 * Searches by metadata regardless of group ID
 * CRITICAL: Excludes transactions from the current batch to allow twin purchases in same file
 */
export async function findExactDuplicate(params: {
  businessId: number;
  cardId: number;
  dealDate: string;
  installmentTotal: number;
  installmentIndex: number;
  chargedAmountIls: number;
  currentBatchId: number; // Exclude transactions from this batch
}) {
  const amountTolerance = params.chargedAmountIls * 0.01;
  
  const [duplicate] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.businessId, params.businessId),
        eq(transactions.cardId, params.cardId),
        eq(transactions.dealDate, params.dealDate),
        eq(transactions.installmentTotal, params.installmentTotal),
        eq(transactions.installmentIndex, params.installmentIndex),
        eq(transactions.status, 'completed'), // Only check completed (ignore projected)
        sql`${transactions.chargedAmountIls}::numeric BETWEEN ${params.chargedAmountIls - amountTolerance} AND ${params.chargedAmountIls + amountTolerance}`,
        // CRITICAL: Exclude current batch (allows twin purchases in same file)
        not(eq(transactions.uploadBatchId, params.currentBatchId))
      )
    )
    .limit(1);
  
  return duplicate || null;
}

/**
 * Find ANY projected payment matching metadata (ignores group IDs entirely)
 * This is the "pool" approach - take first available slot
 */
export async function findProjectedPaymentInBucket(params: {
  businessId: number;
  cardId: number;
  dealDate: string;
  installmentTotal: number;
  installmentIndex: number;
  chargedAmountIls: number;
}) {
  const amountTolerance = params.chargedAmountIls * 0.01;
  
  const [projectedPayment] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.businessId, params.businessId),
        eq(transactions.cardId, params.cardId),
        eq(transactions.dealDate, params.dealDate),
        eq(transactions.installmentTotal, params.installmentTotal),
        eq(transactions.installmentIndex, params.installmentIndex),
        eq(transactions.status, 'projected'),
        sql`${transactions.chargedAmountIls}::numeric BETWEEN ${params.chargedAmountIls - amountTolerance} AND ${params.chargedAmountIls + amountTolerance}`
      )
    )
    .limit(1);

  return projectedPayment || null;
}

/**
 * Count how many groups exist with the given baseGroupId (including _copy_N variants)
 * Used to generate unique suffix for twin purchases
 */
export async function countGroupsWithBaseId(baseGroupId: string) {
  const result = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${transactions.installmentGroupId})` })
    .from(transactions)
    .where(
      sql`(${transactions.installmentGroupId} = ${baseGroupId} OR ${transactions.installmentGroupId} LIKE ${baseGroupId + '_copy_%'})`
    );

  return result[0]?.count || 0;
}

/**
 * Find orphaned backfilled Payment 1 by metadata (business, card, date, amount)
 * Used to match "Salted Orphans" when real Payment 1 arrives
 * 
 * The "Salted Orphan" problem:
 * 1. User uploads Payment 2/24 first
 * 2. Twin A creates standard group (baseGroupId)
 * 3. Twin B detects collision, creates salted group (SHA256-hashed)
 * 4. Both backfill Payment 1 as 'completed' with CALCULATED amount (Total - (RegularPayment × (N-1)))
 * 5. User uploads Payment 1/24 later
 * 6. Twin A finds its Payment 1 by hash
 * 7. Twin B cannot find its Payment 1 by hash (salted ID is unpredictable)
 * 8. This function finds Twin B's Payment 1 by matching metadata instead
 * 
 * NOTE: We use 5% tolerance for amount matching (instead of 1%) to handle:
 * - Exchange rate differences between backfill calculation and real charge
 * - Edge cases where Payment 1 variance is distributed differently
 */
export async function findOrphanedBackfilledPayment1(params: {
  businessId: number;
  cardId: number;
  dealDate: string; // Original purchase date (YYYY-MM-DD)
  installmentTotal: number;
  chargedAmountIls: number;
  baseGroupId: string; // Exclude this ID from search
  currentBatchId: number; // Exclude transactions from current batch (already updated by twins in same file)
}) {
  // Use 5% tolerance instead of 1% to handle edge cases
  const amountTolerance = params.chargedAmountIls * 0.05;
  
  const [orphan] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.businessId, params.businessId),
        eq(transactions.cardId, params.cardId),
        eq(transactions.dealDate, params.dealDate),
        eq(transactions.installmentTotal, params.installmentTotal),
        eq(transactions.installmentIndex, 1),
        eq(transactions.status, 'completed'),
        // 5% amount tolerance (wider than normal to handle Payment 1 variance edge cases)
        sql`${transactions.chargedAmountIls}::numeric BETWEEN ${params.chargedAmountIls - amountTolerance} AND ${params.chargedAmountIls + amountTolerance}`,
        // ONLY exclude the standard hash we just checked
        not(eq(transactions.installmentGroupId, params.baseGroupId)),
        // CRITICAL: Exclude current batch (prevents finding ghosts already updated by earlier twins in same file)
        not(eq(transactions.uploadBatchId, params.currentBatchId))
        // REMOVED: not(like(..._copy_%)) - we now search ALL groups
      )
    )
    .limit(1);

  return orphan || null;
}
