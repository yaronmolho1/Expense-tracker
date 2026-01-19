import { db } from '@/lib/db';
import { businesses, cards, subscriptions, transactions } from '@/lib/db/schema';

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
  businesses: Array<{ id: number; name: string; displayName: string }>;
  cards: Array<{ id: number; last4: string; nickname: string }>;
  subscriptions: Array<{ id: number; name?: string; businessId: number }>;
  transactions: Array<{ id: number; dealDate: string; transactionType?: string }>;
}

export async function seedBulkDeleteTestData(): Promise<SeedResult> {
  // Create test businesses
  const [business1, business2, business3] = await db
    .insert(businesses)
    .values([
      { name: 'Amazon', displayName: 'Amazon' },
      { name: 'Netflix', displayName: 'Netflix' },
      { name: 'Spotify', displayName: 'Spotify' },
    ])
    .returning();

  // Create test cards
  const [card1, card2] = await db
    .insert(cards)
    .values([
      { last4: '1234', nickname: 'Main Card', institutionId: 1, institutionName: 'Test Bank' },
      { last4: '5678', nickname: 'Secondary Card', institutionId: 1, institutionName: 'Test Bank' },
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

  // Create one-time transactions spanning 2024
  const oneTimeTransactions = await db
    .insert(transactions)
    .values([
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-01-15',
        chargedAmountIls: '150.00',
        transactionType: 'one_time',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-03-20',
        chargedAmountIls: '89.99',
        transactionType: 'one_time',
      },
      {
        businessId: business1.id,
        cardId: card2.id,
        dealDate: '2024-06-10',
        chargedAmountIls: '250.00',
        transactionType: 'one_time',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-09-05',
        chargedAmountIls: '75.50',
        transactionType: 'one_time',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-12-15',
        chargedAmountIls: '199.99',
        transactionType: 'one_time',
      },
      // Some in 2025 (outside typical test range)
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2025-02-01',
        chargedAmountIls: '120.00',
        transactionType: 'one_time',
      },
    ])
    .returning();

  // Create complete installment group (all payments in 2024)
  const completeGroupId = 'complete-group-001';
  const completeInstallments = await db
    .insert(transactions)
    .values([
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-01-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 1,
        installmentCount: 6,
        chargedAmountIls: '100.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-02-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 2,
        installmentCount: 6,
        chargedAmountIls: '100.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-03-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 3,
        installmentCount: 6,
        chargedAmountIls: '100.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-04-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 4,
        installmentCount: 6,
        chargedAmountIls: '100.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-05-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 5,
        installmentCount: 6,
        chargedAmountIls: '100.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-06-01',
        installmentGroupId: completeGroupId,
        installmentIndex: 6,
        installmentCount: 6,
        chargedAmountIls: '100.00',
        status: 'completed',
      },
    ])
    .returning();

  // Create partial installment group (payments span 2024-2025)
  const partialGroupId = 'partial-group-001';
  const partialInstallments = await db
    .insert(transactions)
    .values([
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-05-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 1,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-06-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 2,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-07-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 3,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-08-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 4,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-09-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 5,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-10-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 6,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-11-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 7,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'completed',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2024-12-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 8,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'completed',
      },
      // These extend into 2025
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2025-01-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 9,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'projected',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2025-02-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 10,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'projected',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2025-03-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 11,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'projected',
      },
      {
        businessId: business1.id,
        cardId: card1.id,
        dealDate: '2025-04-01',
        installmentGroupId: partialGroupId,
        installmentIndex: 12,
        installmentCount: 12,
        chargedAmountIls: '50.00',
        status: 'projected',
      },
    ])
    .returning();

  // Create Netflix subscription transactions (monthly, continues into 2025)
  const netflixTransactions = await db
    .insert(transactions)
    .values([
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
    ].map((month) => ({
      businessId: business2.id,
      cardId: card1.id,
      subscriptionId: netflixSub.id,
      dealDate: `${month}-01`,
      chargedAmountIls: '12.99',
      transactionType: 'subscription',
    })))
    .returning();

  // Create Spotify subscription transactions (ends in 2024)
  const spotifyTransactions = await db
    .insert(transactions)
    .values([
      '2024-01',
      '2024-02',
      '2024-03',
      '2024-04',
      '2024-05',
      '2024-06',
    ].map((month) => ({
      businessId: business3.id,
      cardId: card1.id,
      subscriptionId: spotifySub.id,
      dealDate: `${month}-01`,
      chargedAmountIls: '9.99',
      transactionType: 'subscription',
    })))
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
}

/**
 * Seed minimal test data for quick tests
 */
export async function seedMinimalTestData() {
  const [business] = await db
    .insert(businesses)
    .values({ name: 'Test Business', displayName: 'Test Business' })
    .returning();

  const [card] = await db
    .insert(cards)
    .values({
      last4: '0000',
      nickname: 'Test Card',
      institutionId: 1,
      institutionName: 'Test Bank',
    })
    .returning();

  const txs = await db
    .insert(transactions)
    .values([
      {
        businessId: business.id,
        cardId: card.id,
        dealDate: '2024-06-01',
        chargedAmountIls: '100.00',
        transactionType: 'one_time',
      },
      {
        businessId: business.id,
        cardId: card.id,
        dealDate: '2024-07-01',
        chargedAmountIls: '200.00',
        transactionType: 'one_time',
      },
    ])
    .returning();

  return { business, card, transactions: txs };
}
