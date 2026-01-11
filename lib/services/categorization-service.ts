import { db } from '../db';
import { businesses, categories } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
import { createMessage } from '../integrations/anthropic-client';
import { z } from 'zod';
import logger from '@/lib/logger';

// Zod schema for LLM response validation
const categorizationResponseSchema = z.array(
  z.object({
    name: z.string(),
    primary_category: z.string(),
    child_category: z.string(),
    confidence: z.number().min(0).max(1),
  })
);

type CategorizationResult = z.infer<typeof categorizationResponseSchema>[0];

/**
 * Categorization Service
 *
 * Uses Claude (Anthropic LLM) to automatically categorize businesses based on their names.
 * Processes businesses in batches of 50 to optimize API costs.
 */
export class CategorizationService {
  private readonly BATCH_SIZE = 50; // Optimized for speed + token limits
  private readonly PARALLEL_BATCHES = 5; // Process 5 batches concurrently
  private readonly AUTO_APPLY_THRESHOLD = 0.8;
  private readonly MODEL = 'claude-3-haiku-20240307';
  private readonly MAX_TOKENS = 4096; // Maximum for Haiku model

  /**
   * Get the full category tree formatted for the LLM prompt
   */
  private async getCategoryTree(): Promise<string> {
    const allCategories = await db
      .select()
      .from(categories)
      .orderBy(categories.displayOrder);

    // Build hierarchical structure
    const parents = allCategories.filter((c) => c.level === 0);
    const children = allCategories.filter((c) => c.level === 1);

    let tree = 'Available Categories:\n\n';
    for (const parent of parents) {
      tree += `${parent.name}:\n`;
      const parentChildren = children.filter((c) => c.parentId === parent.id);
      for (const child of parentChildren) {
        tree += `  - ${child.name}\n`;
      }
      tree += '\n';
    }

    return tree;
  }

  /**
   * Build the prompt for Claude
   */
  private async buildPrompt(businessNames: string[]): Promise<string> {
    const categoryTree = await this.getCategoryTree();
    
    // Get list of valid parent categories for explicit validation
    const allCategories = await db.select().from(categories);
    const parentCategories = allCategories
      .filter((c) => c.level === 0)
      .map((c) => c.name)
      .sort();

    return `You are an Israeli expense categorization expert. Given business names (in Hebrew and English), categorize them into the provided category tree.

VALID PARENT CATEGORIES (you MUST use one of these EXACT names - copy them EXACTLY):
${parentCategories.map((name, idx) => `${idx + 1}. "${name}"`).join('\n')}

${categoryTree}

Businesses to categorize:
${businessNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n')}

CRITICAL INSTRUCTIONS:
1. Return ONLY a JSON array with NO markdown formatting, NO code blocks, NO preamble, NO explanation
2. The "primary_category" field MUST be EXACTLY one of the valid parent categories listed above (case-sensitive, including spaces, ampersands "&", slashes "/", no spaces around "&")
3. The "child_category" field MUST be EXACTLY one of the child categories shown under that parent in the category tree above (case-sensitive, exact spelling)
4. DO NOT invent category names. DO NOT use variations. Examples of WRONG names:
   - WRONG: "Travel & Transportation" → CORRECT: "Transportation & Car"
   - WRONG: "Food & Beverage" → CORRECT: "Food & Household"
   - WRONG: "Technology" → CORRECT: "Communications&Subscriptions"
   - WRONG: "Travel" → CORRECT: "Lifestyle&Leisure" (with child "Travel/vacations")
   - WRONG: "Entertainment" → CORRECT: "Lifestyle&Leisure" (with child "Entertainment&hobbies")
   - WRONG: "Health & Fitness" → CORRECT: "Health/Fitness" (note the slash, not "&")
   - WRONG: "Retail" or "Shopping" → CORRECT: "Food & Household" or "Personal Care" depending on context
5. Provide a confidence score (0.00-1.00) based on how certain you are
6. If a business name is ambiguous or you're unsure, use a lower confidence score
7. Israeli context examples:
   - "רמי לוי" (supermarket) → "Food & Household" / "Groceries"
   - "דור אלון" (gas station) → "Transportation & Car" / "Fuel and ev charging"
   - "Netflix" → "Communications&Subscriptions" / "Streaming services"
   - "OpenAI" or "Anthropic" → "Communications&Subscriptions" / "AI/Developer tools"
   - "Uber" → "Transportation & Car" / "Public Transport"
   - Restaurant names → "Food & Household" / "Eating out and deliveries"
8. IMPORTANT: If a business name contains quotes (like ביה"ס), escape them as \\" in the JSON

EXACT OUTPUT FORMAT (nothing else):
[
  {
    "name": "exact business name from list (escape any quotes as \\\\")",
    "primary_category": "EXACT parent category name from valid list above",
    "child_category": "EXACT child category name from tree above",
    "confidence": 0.95
  }
]

Begin your response with [ and end with ]. Do not include any text before or after the JSON array.`;
  }

  /**
   * Call Claude to categorize businesses
   */
  private async callLLM(businessNames: string[]): Promise<CategorizationResult[]> {
    const prompt = await this.buildPrompt(businessNames);

    try {
      const message = await createMessage({
        model: this.MODEL,
        max_tokens: this.MAX_TOKENS,
        temperature: 0, // Deterministic output
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract text content from response
      let responseText = message.content[0].type === 'text' ? message.content[0].text : '';

      // Clean up response (remove markdown code blocks if present)
      responseText = responseText.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Parse JSON response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        const context: Record<string, unknown> = {
          responseLength: responseText.length,
        };
        
        // Show bytes around error position if it's a SyntaxError (limited context only)
        if (parseError instanceof SyntaxError && parseError.message.includes('position')) {
          const match = parseError.message.match(/position (\d+)/);
          if (match) {
            const pos = parseInt(match[1]);
            const start = Math.max(0, pos - 50);
            const end = Math.min(responseText.length, pos + 50);
            context.errorPosition = pos;
            context.contextAroundError = responseText.substring(start, end);
          }
        }
        
        logger.error(parseError, 'JSON parse error in LLM response');
        throw parseError;
      }

      // Validate with Zod
      const validated = categorizationResponseSchema.parse(parsedResponse);

      return validated;
    } catch (error) {
      logger.error(error, 'LLM categorization failed');
      throw new Error(`Failed to categorize businesses: ${error}`);
    }
  }

  /**
   * Apply categorization results to database
   */
  private async applyCategorizationResults(results: CategorizationResult[]): Promise<{
    applied: number;
    flaggedForReview: number;
    failed: number;
  }> {
    let applied = 0;
    let flaggedForReview = 0;
    let failed = 0;

    // Fetch all categories for lookup
    const allCategories = await db.select().from(categories);

    // Build parent categories map (level 0)
    const parentMap = new Map(
      allCategories
        .filter((c) => c.level === 0)
        .map((c) => [c.name.toLowerCase(), c])
    );

    // Build child categories grouped by parent
    const childrenByParent = new Map<number, typeof allCategories>();
    for (const cat of allCategories.filter((c) => c.level === 1)) {
      if (!childrenByParent.has(cat.parentId!)) {
        childrenByParent.set(cat.parentId!, []);
      }
      childrenByParent.get(cat.parentId!)!.push(cat);
    }

    for (const result of results) {
      try {
        // Find the business by display name
        const [business] = await db
          .select()
          .from(businesses)
          .where(eq(businesses.displayName, result.name))
          .limit(1);

        if (!business) {
          logger.warn({ businessName: result.name }, 'Business not found for categorization');
          failed++;
          continue;
        }

        // Look up primary category (parent)
        const primaryCategory = parentMap.get(result.primary_category.toLowerCase());

        if (!primaryCategory) {
          logger.warn({
            businessName: result.name,
            primaryCategory: result.primary_category,
          }, 'Primary category not found');
          failed++;
          continue;
        }

        // Look up child category within the parent's children
        const childrenOfPrimary = childrenByParent.get(primaryCategory.id) || [];
        let childCategory = childrenOfPrimary.find(
          (c) => c.name.toLowerCase() === result.child_category.toLowerCase()
        );

        // FALLBACK: If not found under expected parent, search globally
        if (!childCategory) {
          logger.warn({
            businessName: result.name,
            childCategory: result.child_category,
            primaryCategory: result.primary_category,
          }, 'Child category not found under expected parent, searching globally');

          // Search all child categories globally
          const globalMatch = allCategories
            .filter((c) => c.level === 1)
            .find((c) => c.name.toLowerCase() === result.child_category.toLowerCase());

          if (globalMatch) {
            // Found in a different parent category
            const actualParent = allCategories.find((c) => c.id === globalMatch.parentId);
            logger.info({
              businessName: result.name,
              foundUnderParent: actualParent?.name,
              childCategory: result.child_category,
            }, 'Found child category under different parent');
            childCategory = globalMatch;

            // Update primary category to match where child actually exists
            const updatedPrimary = allCategories.find((c) => c.id === globalMatch.parentId);
            if (updatedPrimary) {
              logger.info({
                businessName: result.name,
                originalPath: `${result.primary_category}/${result.child_category}`,
                correctedPath: `${updatedPrimary.name}/${globalMatch.name}`,
              }, 'Corrected category path');
              result.primary_category = updatedPrimary.name;
              // Update primaryCategory reference
              primaryCategory.id = updatedPrimary.id;
              primaryCategory.name = updatedPrimary.name;
            }
          } else {
            logger.warn({
              businessName: result.name,
              childCategory: result.child_category,
            }, 'Child category not found anywhere, skipping');
            failed++;
            continue;
          }
        }

        // Update business with categorization
        if (result.confidence >= this.AUTO_APPLY_THRESHOLD) {
          // Auto-apply high confidence categorizations
          await db
            .update(businesses)
            .set({
              primaryCategoryId: primaryCategory.id,
              childCategoryId: childCategory.id,
              categorizationSource: 'llm',
              confidenceScore: result.confidence.toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(businesses.id, business.id));

          applied++;
          logger.info({
            businessName: result.name,
            categoryPath: `${result.primary_category}/${result.child_category}`,
            confidence: result.confidence,
          }, 'Auto-applied categorization');
        } else {
          // Low confidence: save categorization but flag for review
          await db
            .update(businesses)
            .set({
              primaryCategoryId: primaryCategory.id,
              childCategoryId: childCategory.id,
              categorizationSource: 'suggested',
              confidenceScore: result.confidence.toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(businesses.id, business.id));

          flaggedForReview++;
          logger.warn({
            businessName: result.name,
            categoryPath: `${result.primary_category}/${result.child_category}`,
            confidence: result.confidence,
          }, 'Low confidence categorization flagged for review');
        }
      } catch (error) {
        logger.error(error, `Failed to apply categorization for ${result.name}`);
        failed++;
      }
    }

    return { applied, flaggedForReview, failed };
  }

  /**
   * Main entry point: Categorize all uncategorized businesses
   * Uses parallel batching for maximum speed
   */
  async categorizeUncategorizedBusinesses(batchId?: number): Promise<{
    totalProcessed: number;
    applied: number;
    flaggedForReview: number;
    failed: number;
  }> {
    logger.info({ batchId }, 'Starting LLM categorization');

    // Find ALL businesses without categories
    const allUncategorized = await db
      .select()
      .from(businesses)
      .where(isNull(businesses.primaryCategoryId));

    if (allUncategorized.length === 0) {
      logger.info({}, 'No uncategorized businesses found');
      return { totalProcessed: 0, applied: 0, flaggedForReview: 0, failed: 0 };
    }

    logger.info({
      uncategorizedCount: allUncategorized.length,
      batchSize: this.BATCH_SIZE,
      parallelBatches: this.PARALLEL_BATCHES,
    }, 'Found uncategorized businesses, processing in batches');

    // Split into batches
    const batches: typeof allUncategorized[] = [];
    for (let i = 0; i < allUncategorized.length; i += this.BATCH_SIZE) {
      batches.push(allUncategorized.slice(i, i + this.BATCH_SIZE));
    }

    logger.info({ totalBatches: batches.length }, 'Batch split complete');

    let totalApplied = 0;
    let totalFlagged = 0;
    let totalFailed = 0;

    // Process batches in parallel chunks
    for (let i = 0; i < batches.length; i += this.PARALLEL_BATCHES) {
      const parallelBatches = batches.slice(i, i + this.PARALLEL_BATCHES);
      const batchNums = Array.from(
        { length: parallelBatches.length },
        (_, idx) => i + idx + 1
      );

      logger.info({
        batchRange: `${batchNums[0]}-${batchNums[batchNums.length - 1]}`,
      }, 'Processing batches in parallel');

      // Process batches in parallel using Promise.all
      const results = await Promise.all(
        parallelBatches.map(async (batch, idx) => {
          const batchNum = batchNums[idx];
          const businessNames = batch.map((b) => b.displayName);

          try {
            // Call LLM
            const llmResults = await this.callLLM(businessNames);

            // Apply results to database
            const summary = await this.applyCategorizationResults(llmResults);

            logger.info({
              batchNum,
              applied: summary.applied,
              flagged: summary.flaggedForReview,
              failed: summary.failed,
            }, 'Batch completed');

            return summary;
          } catch (error) {
            logger.error(error, `Batch ${batchNum} failed`);
            return { applied: 0, flaggedForReview: 0, failed: batch.length };
          }
        })
      );

      // Aggregate results
      for (const result of results) {
        totalApplied += result.applied;
        totalFlagged += result.flaggedForReview;
        totalFailed += result.failed;
      }
    }

    logger.info({
      totalProcessed: allUncategorized.length,
      autoApplied: totalApplied,
      flaggedForReview: totalFlagged,
      failed: totalFailed,
    }, 'All categorization complete');

    return {
      totalProcessed: allUncategorized.length,
      applied: totalApplied,
      flaggedForReview: totalFlagged,
      failed: totalFailed,
    };
  }
}

// Export singleton instance
export const categorizationService = new CategorizationService();
