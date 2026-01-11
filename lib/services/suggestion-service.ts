import { db } from '../db';
import { businesses, businessMergeSuggestions } from '../db/schema';
import { calculateSimilarity } from '../utils/fuzzy-match';
import { sql, and, eq, isNull } from 'drizzle-orm';

/**
 * Suggestion Service
 *
 * Detects potential duplicate businesses and suggests merges based on fuzzy name matching.
 */
export class SuggestionService {
  private readonly SIMILARITY_THRESHOLD = 0.55; // Lower threshold to catch more potential duplicates
  private readonly MIN_TRANSACTIONS = 1; // Only suggest merges for businesses with 1+ transactions

  /**
   * Detect and create business merge suggestions
   * Compares all businesses pairwise and creates suggestions for similar names
   */
  async detectBusinessMerges(): Promise<{
    suggestionsCreated: number;
    businessesCompared: number;
  }> {
    console.log('🔍 Starting business merge detection...');

    // Fetch all active businesses with transaction counts (exclude merged businesses)
    const result = await db.execute(sql`
      SELECT
        b.id,
        b.normalized_name,
        b.display_name,
        b.primary_category_id,
        COALESCE((SELECT COUNT(*)::int FROM transactions t WHERE t.business_id = b.id), 0) as transaction_count
      FROM businesses b
      WHERE b.merged_to_id IS NULL
    `);

    const allBusinesses = (result as any[]).map(row => ({
      id: row.id as number,
      normalizedName: row.normalized_name as string,
      displayName: row.display_name as string,
      primaryCategoryId: row.primary_category_id as number | null,
      transactionCount: row.transaction_count as number,
    }));

    console.log(`Found ${allBusinesses.length} businesses to compare`);

    // Filter businesses with enough transactions
    const activeBusinesses = allBusinesses.filter(
      (b) => (b.transactionCount ?? 0) >= this.MIN_TRANSACTIONS
    );

    console.log(
      `Comparing ${activeBusinesses.length} businesses with ${this.MIN_TRANSACTIONS}+ transactions`
    );

    let suggestionsCreated = 0;
    let pairsCompared = 0;

    // Compare each pair (i, j where i < j)
    for (let i = 0; i < activeBusinesses.length; i++) {
      for (let j = i + 1; j < activeBusinesses.length; j++) {
        const business1 = activeBusinesses[i];
        const business2 = activeBusinesses[j];

        pairsCompared++;

        // Skip if already the same business
        if (business1.id === business2.id) continue;

        // Calculate similarity
        const similarity = calculateSimilarity(
          business1.normalizedName,
          business2.normalizedName
        );

        // Check if similarity exceeds threshold
        if (similarity >= this.SIMILARITY_THRESHOLD) {
          // Check if suggestion already exists
          const existingSuggestion = await db.query.businessMergeSuggestions.findFirst({
            where: and(
              sql`(
                (${businessMergeSuggestions.businessId1} = ${business1.id} AND ${businessMergeSuggestions.businessId2} = ${business2.id})
                OR
                (${businessMergeSuggestions.businessId1} = ${business2.id} AND ${businessMergeSuggestions.businessId2} = ${business1.id})
              )`,
              isNull(businessMergeSuggestions.resolvedAt)
            ),
          });

          if (!existingSuggestion) {
            // Create new suggestion
            await db.insert(businessMergeSuggestions).values({
              businessId1: business1.id,
              businessId2: business2.id,
              similarityScore: similarity.toFixed(2),
              suggestionReason: 'fuzzy_match',
              status: 'pending',
            });

            suggestionsCreated++;
            console.log(
              `✨ Created suggestion: "${business1.displayName}" ↔ "${business2.displayName}" (${(similarity * 100).toFixed(1)}%)`
            );
          }
        }
      }
    }

    console.log(`✅ Business merge detection complete`);
    console.log(`   - Pairs compared: ${pairsCompared}`);
    console.log(`   - Suggestions created: ${suggestionsCreated}`);

    return {
      suggestionsCreated,
      businessesCompared: activeBusinesses.length,
    };
  }

  /**
   * Get all pending business merge suggestions
   */
  async getPendingMergeSuggestions() {
    return await db.query.businessMergeSuggestions.findMany({
      where: eq(businessMergeSuggestions.status, 'pending'),
      with: {
        business1: true,
        business2: true,
      },
      orderBy: (suggestions, { desc }) => [desc(suggestions.similarityScore)],
    });
  }

  /**
   * Approve a merge suggestion and merge businesses
   *
   * @param suggestionId ID of the suggestion to approve
   * @param keepBusinessId ID of the business to keep (canonical)
   */
  async approveMerge(suggestionId: number, keepBusinessId: number): Promise<{
    transactionsUpdated: number;
  }> {
    // Get the suggestion
    const suggestion = await db.query.businessMergeSuggestions.findFirst({
      where: eq(businessMergeSuggestions.id, suggestionId),
    });

    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`);
    }

    // Determine which business to merge from
    const mergeFromId =
      suggestion.businessId1 === keepBusinessId
        ? suggestion.businessId2
        : suggestion.businessId1;

    if (mergeFromId === keepBusinessId) {
      throw new Error('Cannot merge business into itself');
    }

    console.log(
      `🔄 Merging business ${mergeFromId} into ${keepBusinessId}...`
    );

    let transactionsUpdated = 0;

    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      // Step 1: Update transactions and track original business
      const result = await tx.execute(sql`
        UPDATE transactions
        SET business_id = ${keepBusinessId},
            original_business_id = COALESCE(original_business_id, business_id)
        WHERE business_id = ${mergeFromId}
      `);

      transactionsUpdated = (result as any).rowCount || 0;

      // Step 2: Mark business as merged (not deleted)
      await tx
        .update(businesses)
        .set({ mergedToId: keepBusinessId })
        .where(eq(businesses.id, mergeFromId));

      // Step 3: Mark suggestion as approved
      await tx
        .update(businessMergeSuggestions)
        .set({
          status: 'approved',
          resolvedAt: new Date(),
        })
        .where(eq(businessMergeSuggestions.id, suggestionId));
    });

    console.log(`✅ Merge complete: ${transactionsUpdated} transactions updated`);

    return { transactionsUpdated };
  }

  /**
   * Reject a merge suggestion
   */
  async rejectMerge(suggestionId: number): Promise<void> {
    await db
      .update(businessMergeSuggestions)
      .set({
        status: 'rejected',
        resolvedAt: new Date(),
      })
      .where(eq(businessMergeSuggestions.id, suggestionId));

    console.log(`❌ Suggestion ${suggestionId} rejected`);
  }
}

// Export singleton instance
export const suggestionService = new SuggestionService();
