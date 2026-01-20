import { db } from '@/lib/db';
import { businesses, cards, subscriptions, transactions, uploadBatches } from '@/lib/db/schema';
import crypto from 'crypto';

/**
 * Test data seeder for bulk delete tests
 *
 * Creates comprehensive test data including:
 * - One-time transactions across multiple dates
 * - Complete and partial installment groups
 * - Active subscriptions with regular payments
 * - Multiple businesses and cards for filtering
 */

export interface SeedResult {
  businesses: Array<{ id: number; normalizedName: string; displayName: string }>;
  cards: Array<{ id: number; last4Digits: string; nickname: string | null }>;
  subscriptions: Array<{ id: number; name?: string | null; businessId: number }>;
  transactions: Array<{ id: number; dealDate: string; transactionType: string }>;
}

/**
 * Helper to generate required transaction fields
 */
function createTransactionHash(businessId: number, dealDate: string, amount: string, index = 0): string {
  return crypto
    .createHash('sha256')
    .update(`${businessId}-${dealDate}-${amount}-${index}-${Date.now()}`)
    .digest('hex');
}

export async function seedBulkDeleteTestData(): Promise<SeedResult> {
  // Create test businesses
  const [business1, business2, business3] = await db
    .insert(businesses)
    .values([
      { normalizedName: 'amazon', displayName: 'Amazon' },
      { normalizedName: 'netflix', displayName: 'Netflix' },
      { normalizedName: 'spotify', displayName: 'Spotify' },
    ])
    .returning();

  // Create test cards
  const [card1, card2] = await db
    .insert(cards)
    .values([
      {
        last4Digits: '1234',
        nickname: 'Main Card',
        fileFormatHandler: 'test-handler',
        owner: 'test-owner'
      },
      {
        last4Digits: '5678',
        nickname: 'Secondary Card',
        fileFormatHandler: 'test-handler',
        owner: 'test-owner'
      },
    ])
    .returning();

  // Create subscriptions
  const [netflixSub, spotifySub] = await db
    .insert(subscriptions)
    .values([
      {
        businessId: business2.id,
        cardId: card1.id,
        amount: '12.99',
        frequency: 'monthly',
        startDate: '2024-01-01',
        status: 'active',
        name: 'Netflix Premium',
      },
      {
        businessId: business3.id,
        cardId: card1.id,
        amount: '9.99',
        frequency: 'monthly',
        startDate: '2024-01-01',
        status: 'active',
        name: 'Spotify Premium',
      },
    ])
    .returning();

  // Create upload batch for transactions
  const [batch] = await db
    .insert(uploadBatches)
    .values({
      fileCount: 1,
      status: 'completed',
    })
    .returning();

  // Create one-time transactions spanning 2024
  const oneTimeTransactions = await db
    .insert(transactions)
    .values([
      {
        transactionHash: createTransactionHash(business1.id, '2024-01-15', '150.00', 0),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-01-15',
        originalAmount: '150.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '150.00',
        transactionType: 'one_time',
        paymentType: 'one_time',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-03-20', '89.99', 1),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-03-20',
        originalAmount: '89.99',
        originalCurrency: 'ILS',
        chargedAmountIls: '89.99',
        transactionType: 'one_time',
        paymentType: 'one_time',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-06-10', '250.00', 2),
        businessId: business1.id,
        cardId: card2.id,
        dealDate: '2024-06-10',
        originalAmount: '250.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '250.00',
        transactionType: 'one_time',
        paymentType: 'one_time',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-09-05', '75.50', 3),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-09-05',
        originalAmount: '75.50',
        originalCurrency: 'ILS',
        chargedAmountIls: '75.50',
        transactionType: 'one_time',
        paymentType: 'one_time',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-12-15', '199.99', 4),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-12-15',
        originalAmount: '199.99',
        originalCurrency: 'ILS',
        chargedAmountIls: '199.99',
        transactionType: 'one_time',
        paymentType: 'one_time',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      // Some in 2025 (outside typical test range)
      {
        transactionHash: createTransactionHash(business1.id, '2025-02-01', '120.00', 5),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2025-02-01',
        originalAmount: '120.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '120.00',
        transactionType: 'one_time',
        paymentType: 'one_time',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
    ])
    .returning();

  // Create complete installment group (all payments in 2024)
  const completeGroupId = 'complete-group-001';
  const completeInstallments = await db
    .insert(transactions)
    .values([
      {
        transactionHash: createTransactionHash(business1.id, '2024-01-01', '100.00', 10),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-01-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 1,
        installmentTotal: 6,
        originalAmount: '100.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '100.00',
        installmentAmount: '100.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-02-01', '100.00', 11),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-02-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 2,
        installmentTotal: 6,
        originalAmount: '100.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '100.00',
        installmentAmount: '100.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-03-01', '100.00', 12),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-03-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 3,
        installmentTotal: 6,
        originalAmount: '100.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '100.00',
        installmentAmount: '100.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-04-01', '100.00', 13),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-04-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 4,
        installmentTotal: 6,
        originalAmount: '100.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '100.00',
        installmentAmount: '100.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-05-01', '100.00', 14),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-05-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 5,
        installmentTotal: 6,
        originalAmount: '100.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '100.00',
        installmentAmount: '100.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-06-01', '100.00', 15),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-06-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 6,
        installmentTotal: 6,
        originalAmount: '100.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '100.00',
        installmentAmount: '100.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
    ])
    .returning();

  // Create partial installment group (payments span 2024-2025)
  const partialGroupId = 'partial-group-001';
  const partialInstallments = await db
    .insert(transactions)
    .values([
      {
        transactionHash: createTransactionHash(business1.id, '2024-05-01', '50.00', 20),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-05-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 1,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-06-01', '50.00', 21),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-06-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 2,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-07-01', '50.00', 22),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-07-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 3,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-08-01', '50.00', 23),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-08-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 4,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-09-01', '50.00', 24),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-09-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 5,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-10-01', '50.00', 25),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-10-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 6,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-11-01', '50.00', 26),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-11-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 7,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2024-12-01', '50.00', 27),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-12-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 8,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      // These extend into 2025
      {
        transactionHash: createTransactionHash(business1.id, '2025-01-01', '50.00', 28),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2025-01-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 9,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'projected',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2025-02-01', '50.00', 29),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2025-02-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 10,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'projected',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2025-03-01', '50.00', 30),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2025-03-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 11,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'projected',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business1.id, '2025-04-01', '50.00', 31),
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2025-04-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 12,
        installmentTotal: 12,
        originalAmount: '50.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '50.00',
        installmentAmount: '50.00',
        transactionType: 'installment',
        paymentType: 'installments',
        status: 'projected',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
    ])
    .returning();

  // Create Netflix subscription transactions (monthly, continues into 2025)
  const netflixTransactions = await db
    .insert(transactions)
    .values(
      [
        '2024-01',
        '2024-02',
        '2024-03',
        '2024-04',
        '2024-05',
        '2024-06',
        '2024-07',
        '2024-08',
        '2024-09',
        '2024-10',
        '2024-11',
        '2024-12',
        '2025-01',
        '2025-02',
      ].map((month, idx) => ({
        transactionHash: createTransactionHash(business2.id, `${month}-01`, '12.99', 40 + idx),
        businessId: business2.id,
        cardId: card1.id,
        subscriptionId: netflixSub.id,
        dealDate: `${month}-01`,
        originalAmount: '12.99',
        originalCurrency: 'ILS',
        chargedAmountIls: '12.99',
        transactionType: 'subscription' as const,
        paymentType: 'one_time' as const,
        status: 'completed' as const,
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      }))
    )
    .returning();

  // Create Spotify subscription transactions (ends in 2024)
  const spotifyTransactions = await db
    .insert(transactions)
    .values(
      ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'].map((month, idx) => ({
        transactionHash: createTransactionHash(business3.id, `${month}-01`, '9.99', 60 + idx),
        businessId: business3.id,
        cardId: card1.id,
        subscriptionId: spotifySub.id,
        dealDate: `${month}-01`,
        originalAmount: '9.99',
        originalCurrency: 'ILS',
        chargedAmountIls: '9.99',
        transactionType: 'subscription' as const,
        paymentType: 'one_time' as const,
        status: 'completed' as const,
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      }))
    )
    .returning();

  return {
    businesses: [business1, business2, business3],
    cards: [card1, card2],
    subscriptions: [netflixSub, spotifySub],
    transactions: [
      ...oneTimeTransactions,
      ...completeInstallments,
      ...partialInstallments,
      ...netflixTransactions,
      ...spotifyTransactions,
    ],
  };
}

/**
 * Clean up all test data
 */
export async function cleanupBulkDeleteTestData(): Promise<void> {
  await db.delete(transactions).execute();
  await db.delete(subscriptions).execute();
  await db.delete(businesses).execute();
  await db.delete(cards).execute();
  await db.delete(uploadBatches).execute();
}

/**
 * Seed minimal test data for quick tests
 */
export async function seedMinimalTestData() {
  const [business] = await db
    .insert(businesses)
    .values({ normalizedName: 'test-business', displayName: 'Test Business' })
    .returning();

  const [card] = await db
    .insert(cards)
    .values({
      last4Digits: '0000',
      nickname: 'Test Card',
      fileFormatHandler: 'test-handler',
      owner: 'test-owner',
    })
    .returning();

  const [batch] = await db
    .insert(uploadBatches)
    .values({
      fileCount: 1,
      status: 'completed',
    })
    .returning();

  const txs = await db
    .insert(transactions)
    .values([
      {
        transactionHash: createTransactionHash(business.id, '2024-06-01', '100.00', 0),
        businessId: business.id,
        cardId: card.id,
        dealDate: '2024-06-01',
        originalAmount: '100.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '100.00',
        transactionType: 'one_time',
        paymentType: 'one_time',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
      {
        transactionHash: createTransactionHash(business.id, '2024-07-01', '200.00', 1),
        businessId: business.id,
        cardId: card.id,
        dealDate: '2024-07-01',
        originalAmount: '200.00',
        originalCurrency: 'ILS',
        chargedAmountIls: '200.00',
        transactionType: 'one_time',
        paymentType: 'one_time',
        status: 'completed',
        sourceFile: 'test-data.csv',
        uploadBatchId: batch.id,
      },
    ])
    .returning();

  return { business, card, transactions: txs };
}
