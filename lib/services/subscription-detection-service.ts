import { db } from '../db';
import { transactions, subscriptionSuggestions } from '../db/schema';
import { sql, eq, and, isNull } from 'drizzle-orm';

/**
 * Subscription Detection Service
 *
 * Analyzes transaction patterns to detect potential recurring subscriptions.
 * Looks for consistent charges from the same business at regular intervals.
 */
export class SubscriptionDetectionService {
  private readonly MIN_OCCURRENCES = 3;
  private readonly MIN_DAYS_APART = 60; // At least 2 months of data
  private readonly MONTHLY_INTERVAL = 30; // ±5 days
  private readonly ANNUAL_INTERVAL = 365; // ±10 days
  private readonly AMOUNT_VARIANCE_THRESHOLD = 0.05; // ±5%

  // Subscription keywords (Hebrew and English)
  private readonly SUBSCRIPTION_KEYWORDS = [
    // Hebrew
    'מנוי',
    'הוראת קבע',
    'חודשי',
    'שנתי',
    // English
    'subscription',
    'monthly',
    'membership',
    'netflix',
    'spotify',
    'apple',
    'google',
    'amazon prime',
    'youtube',
    'disney',
    'hbo',
    'gym',
    'insurance',
    'hosting',
    'cloud',
    'saas',
  ];

  /**
   * Detect potential subscriptions from transaction patterns
   */
  async detectSubscriptions(): Promise<{
    suggestionsCreated: number;
    patternsAnalyzed: number;
  }> {
    console.log('🔍 Starting subscription detection...');

    // Query for potential subscription patterns
    // Group by business + card + amount, find recurring charges
    const candidates = await db.execute<{
      business_id: number;
      business_name: string;
      card_id: number;
      charged_amount_ils: string;
      occurrence_count: number;
      first_occurrence: Date;
      last_occurrence: Date;
      transaction_dates: Date[];
    }>(sql`
      SELECT
        business_id,
        (SELECT display_name FROM businesses WHERE id = t.business_id) as business_name,
        card_id,
        charged_amount_ils,
        COUNT(*)::int as occurrence_count,
        MIN(deal_date) as first_occurrence,
        MAX(deal_date) as last_occurrence,
        ARRAY_AGG(deal_date ORDER BY deal_date) as transaction_dates
      FROM transactions t
      WHERE status = 'completed'
        AND subscription_id IS NULL
        AND payment_type = 'one_time'
      GROUP BY business_id, card_id, charged_amount_ils
      HAVING COUNT(*) >= ${this.MIN_OCCURRENCES}
        AND (MAX(deal_date) - MIN(deal_date)) >= ${this.MIN_DAYS_APART}
    `);

    const rows = candidates || [];
    console.log(`Found ${rows.length} potential subscription patterns`);

    let suggestionsCreated = 0;

    for (const candidate of rows) {
      // Parse transaction_dates (PostgreSQL array comes as string or actual array depending on driver)
      let transactionDates: Date[];
      const rawDates = candidate.transaction_dates as any;

      if (typeof rawDates === 'string') {
        // Parse PostgreSQL array string format: {2024-01-01,2024-02-01}
        const dateStrings = rawDates
          .replace(/[{}]/g, '')
          .split(',')
          .filter((s: string) => s.trim());
        transactionDates = dateStrings.map((s: string) => new Date(s.trim()));
      } else {
        transactionDates = rawDates.map((d: Date | string) => new Date(d));
      }

      // Calculate intervals between charges
      const dates = transactionDates;
      const intervals: number[] = [];

      for (let i = 1; i < dates.length; i++) {
        const diffDays = Math.floor(
          (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
        );
        intervals.push(diffDays);
      }

      // Calculate average interval
      const avgInterval =
        intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

      // Determine frequency
      let frequency: 'monthly' | 'annual' | null = null;
      let isRegularInterval = false;

      // Check for monthly (30 ±5 days)
      if (
        Math.abs(avgInterval - this.MONTHLY_INTERVAL) <= 5 &&
        intervals.every((i) => Math.abs(i - this.MONTHLY_INTERVAL) <= 5)
      ) {
        frequency = 'monthly';
        isRegularInterval = true;
      }
      // Check for annual (365 ±10 days)
      else if (
        Math.abs(avgInterval - this.ANNUAL_INTERVAL) <= 10 &&
        intervals.every((i) => Math.abs(i - this.ANNUAL_INTERVAL) <= 10)
      ) {
        frequency = 'annual';
        isRegularInterval = true;
      }
      // For keyword matches without clear interval, default to monthly
      else if (avgInterval <= 45) {
        frequency = 'monthly';
      } else {
        frequency = 'annual';
      }

      // Check for subscription keywords in business name
      const hasKeyword = this.SUBSCRIPTION_KEYWORDS.some((keyword) =>
        candidate.business_name.toLowerCase().includes(keyword.toLowerCase())
      );

      // Create suggestion if:
      // 1. Regular interval detected, OR
      // 2. Has subscription keyword (even with 2 occurrences)
      if ((isRegularInterval || hasKeyword) && candidate.occurrence_count >= 2) {
        // Check if suggestion already exists or is in freeze period
        const existingSuggestion = await db.query.subscriptionSuggestions.findFirst({
          where: and(
            eq(subscriptionSuggestions.businessName, candidate.business_name),
            eq(subscriptionSuggestions.cardId, candidate.card_id),
            eq(
              subscriptionSuggestions.detectedAmount,
              parseFloat(candidate.charged_amount_ils).toFixed(2)
            ),
            isNull(subscriptionSuggestions.resolvedAt)
          ),
        });

        // Check if there's a rejected suggestion still in freeze period
        const rejectedSuggestion = await db.query.subscriptionSuggestions.findFirst({
          where: and(
            eq(subscriptionSuggestions.businessName, candidate.business_name),
            eq(subscriptionSuggestions.cardId, candidate.card_id),
            eq(
              subscriptionSuggestions.detectedAmount,
              parseFloat(candidate.charged_amount_ils).toFixed(2)
            ),
            eq(subscriptionSuggestions.status, 'rejected')
          ),
          orderBy: (suggestions, { desc }) => [desc(suggestions.rejectedUntil)],
        });

        // Skip if rejected and still in freeze period
        const now = new Date();
        const isInFreezePeriod = rejectedSuggestion?.rejectedUntil &&
          new Date(rejectedSuggestion.rejectedUntil) > now;

        console.log(`🔍 Checking freeze for "${candidate.business_name}":`, {
          hasRejected: !!rejectedSuggestion,
          rejectedUntil: rejectedSuggestion?.rejectedUntil,
          isInFreeze: isInFreezePeriod,
          now: now.toISOString(),
        });

        if (isInFreezePeriod) {
          console.log(`⏸️  Skipping "${candidate.business_name}" - in freeze until ${rejectedSuggestion.rejectedUntil}`);
          continue;
        }

        if (!existingSuggestion && !isInFreezePeriod && frequency) {
          // Create new subscription suggestion
          const detectionReason = isRegularInterval
            ? `Regular ${frequency} interval (${avgInterval.toFixed(0)} days avg)`
            : 'Subscription keyword detected';

          await db.execute(sql`
            INSERT INTO subscription_suggestions (
              business_name, card_id, detected_amount, frequency,
              first_occurrence, last_occurrence, occurrence_count,
              detection_reason, status
            ) VALUES (
              ${candidate.business_name},
              ${candidate.card_id},
              ${parseFloat(candidate.charged_amount_ils).toFixed(2)},
              ${frequency}::subscription_frequency,
              ${candidate.first_occurrence},
              ${candidate.last_occurrence},
              ${candidate.occurrence_count},
              ${detectionReason},
              'pending'::suggestion_status
            )
          `);

          suggestionsCreated++;
          console.log(
            `✨ Subscription detected: "${candidate.business_name}" - ${frequency} - ${candidate.occurrence_count} occurrences`
          );
        }
      }
    }

    console.log(`✅ Subscription detection complete`);
    console.log(`   - Patterns analyzed: ${rows.length}`);
    console.log(`   - Suggestions created: ${suggestionsCreated}`);

    return {
      suggestionsCreated,
      patternsAnalyzed: rows.length,
    };
  }

  /**
   * Get all pending subscription suggestions
   */
  async getPendingSuggestions() {
    return await db.query.subscriptionSuggestions.findMany({
      where: eq(subscriptionSuggestions.status, 'pending'),
      with: {
        card: true,
      },
      orderBy: (suggestions, { desc }) => [desc(suggestions.createdAt)],
    });
  }

  /**
   * Approve a subscription suggestion and create subscription
   *
   * @param suggestionId ID of the suggestion to approve
   */
  async approveSuggestion(suggestionId: number): Promise<{ subscriptionId: number }> {
    const suggestion = await db.query.subscriptionSuggestions.findFirst({
      where: eq(subscriptionSuggestions.id, suggestionId),
    });

    if (!suggestion) {
      throw new Error(`Subscription suggestion ${suggestionId} not found`);
    }

    // TODO: Create actual subscription record in subscriptions table
    // For now, just mark as approved

    await db
      .update(subscriptionSuggestions)
      .set({
        status: 'approved',
        resolvedAt: new Date(),
      })
      .where(eq(subscriptionSuggestions.id, suggestionId));

    console.log(`✅ Subscription suggestion ${suggestionId} approved`);

    return { subscriptionId: 0 }; // TODO: Return actual subscription ID
  }

  /**
   * Reject a subscription suggestion
   */
  async rejectSuggestion(suggestionId: number): Promise<void> {
    // Set freeze period to 30 days from now
    const freezeUntil = new Date();
    freezeUntil.setDate(freezeUntil.getDate() + 30);

    await db
      .update(subscriptionSuggestions)
      .set({
        status: 'rejected',
        resolvedAt: new Date(),
        rejectedUntil: freezeUntil,
      })
      .where(eq(subscriptionSuggestions.id, suggestionId));

    console.log(`❌ Subscription suggestion ${suggestionId} rejected (freeze until ${freezeUntil.toISOString()})`);
  }
}

// Export singleton instance
export const subscriptionDetectionService = new SubscriptionDetectionService();
