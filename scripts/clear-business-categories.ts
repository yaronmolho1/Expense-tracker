/**
 * Clear all categories from businesses (set to uncategorized)
 * 
 * Usage (Production):
 *   docker compose --env-file .env.production -f docker-compose.production.yml exec db psql -U expenseuser -d expensedb -c "UPDATE businesses SET primary_category_id = NULL, child_category_id = NULL, categorization_source = NULL, confidence_score = NULL;"
 * 
 * Or run this script:
 *   docker compose --env-file .env.production -f docker-compose.production.yml exec worker tsx scripts/clear-business-categories.ts
 */

import { db } from '../lib/db';
import { businesses } from '../lib/db/schema';

async function clearBusinessCategories() {
  console.log('🔄 Clearing all categories from businesses...\n');

  try {
    const result = await db
      .update(businesses)
      .set({
        primaryCategoryId: null,
        childCategoryId: null,
        categorizationSource: null,
        confidenceScore: null,
      });

    console.log('✅ All business categories cleared successfully!');
    console.log('   All businesses are now uncategorized.');
    console.log('   You can now run the categorization script to recategorize them.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to clear categories:', error);
    process.exit(1);
  }
}

clearBusinessCategories();
