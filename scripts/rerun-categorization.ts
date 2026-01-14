/**
 * One-time script to rerun categorization for all businesses
 * 
 * Usage (Production only):
 *   docker compose -f docker-compose.production.yml exec worker tsx scripts/rerun-categorization.ts
 * 
 * This script reruns LLM categorization for all uncategorized businesses.
 * Use this after fixing API credit issues or other categorization failures.
 * 
 * Environment variables are loaded from .env.production via docker-compose.production.yml
 */

import { categorizationService } from '../lib/services/categorization-service';
import { db } from '../lib/db';
import { businesses } from '../lib/db/schema';
import { isNull } from 'drizzle-orm';

async function rerunCategorization() {
  console.log('🔄 Rerunning categorization for all businesses...\n');

  // Verify API key is set
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is not set!');
    console.error('   Make sure it\'s set in .env.production and loaded in docker-compose');
    process.exit(1);
  }

  // Check API key format (should start with sk-)
  if (!process.env.ANTHROPIC_API_KEY.startsWith('sk-')) {
    console.warn('⚠️  Warning: ANTHROPIC_API_KEY does not start with "sk-"');
    console.warn('   This might indicate an invalid API key format');
  } else {
    console.log('✅ API key found and format looks correct\n');
  }

  try {
    // Check how many uncategorized businesses exist
    const uncategorizedCount = await db
      .select()
      .from(businesses)
      .where(isNull(businesses.primaryCategoryId));

    console.log(`📊 Found ${uncategorizedCount.length} uncategorized businesses\n`);

    if (uncategorizedCount.length === 0) {
      console.log('✅ No uncategorized businesses found. Nothing to do!');
      process.exit(0);
    }

    console.log('🚀 Starting categorization process...\n');

    // Run categorization
    const result = await categorizationService.categorizeUncategorizedBusinesses();

    console.log('\n📊 Results:');
    console.log(`   Total Processed: ${result.totalProcessed}`);
    console.log(`   Auto-Applied: ${result.applied}`);
    console.log(`   Flagged for Review: ${result.flaggedForReview}`);
    console.log(`   Failed: ${result.failed}`);

    if (result.failed > 0) {
      console.log('\n⚠️  Some businesses failed categorization.');
      console.log('   Check logs for details. Common issues:');
      console.log('   - API credits exhausted');
      console.log('   - Invalid API key');
      console.log('   - Network issues');
    }

    if (result.applied > 0 || result.flaggedForReview > 0) {
      console.log('\n✅ Categorization completed successfully!');
      console.log(`   ${result.applied} businesses auto-categorized`);
      console.log(`   ${result.flaggedForReview} businesses flagged for review`);
    }

    if (result.failed === result.totalProcessed) {
      console.log('\n❌ All categorizations failed!');
      console.log('   Most likely cause: Anthropic API credits exhausted');
      console.log('   Action: Add credits to Anthropic account and rerun this script');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

rerunCategorization();
