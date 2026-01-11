/**
 * Test script for LLM categorization
 *
 * Usage: npx tsx scripts/test-categorization.ts
 *
 * This script manually triggers the categorization service to test if it works.
 */

import { categorizationService } from '../lib/services/categorization-service';

async function testCategorization() {
  console.log('🧪 Testing LLM Categorization Service...\n');

  try {
    const result = await categorizationService.categorizeUncategorizedBusinesses();

    console.log('\n📊 Test Results:');
    console.log(`   Total Processed: ${result.totalProcessed}`);
    console.log(`   Auto-Applied: ${result.applied}`);
    console.log(`   Flagged for Review: ${result.flaggedForReview}`);
    console.log(`   Failed: ${result.failed}`);

    if (result.totalProcessed === 0) {
      console.log('\n✅ No uncategorized businesses found. System working correctly!');
    } else if (result.applied > 0 || result.flaggedForReview > 0) {
      console.log('\n✅ Categorization completed successfully!');
    } else {
      console.log('\n⚠️  All categorizations failed. Check API key and logs.');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testCategorization();
