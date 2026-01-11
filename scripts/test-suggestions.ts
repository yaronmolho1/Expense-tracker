/**
 * Test script for suggestion systems (business merges + subscriptions)
 *
 * Usage: npx tsx scripts/test-suggestions.ts
 */

import { suggestionService } from '../lib/services/suggestion-service';
import { subscriptionDetectionService } from '../lib/services/subscription-detection-service';

async function testSuggestions() {
  console.log('🧪 Testing Suggestion Systems...\n');

  try {
    // Test business merge detection
    console.log('═══ Business Merge Detection ═══');
    const mergeResults = await suggestionService.detectBusinessMerges();
    console.log(`\n✅ Business merge detection complete:`);
    console.log(`   - Businesses compared: ${mergeResults.businessesCompared}`);
    console.log(`   - Suggestions created: ${mergeResults.suggestionsCreated}`);

    // Show pending merge suggestions
    const pendingMerges = await suggestionService.getPendingMergeSuggestions();
    if (pendingMerges.length > 0) {
      console.log(`\n📋 Pending merge suggestions (${pendingMerges.length}):`);
      for (const suggestion of pendingMerges.slice(0, 5)) {
        console.log(
          `   - "${(suggestion.business1 as any)?.displayName}" ↔ "${(suggestion.business2 as any)?.displayName}" (${(parseFloat(suggestion.similarityScore) * 100).toFixed(1)}%)`
        );
      }
      if (pendingMerges.length > 5) {
        console.log(`   ... and ${pendingMerges.length - 5} more`);
      }
    } else {
      console.log(`\n✓ No pending merge suggestions`);
    }

    console.log('\n═══ Subscription Detection ═══');
    const subscriptionResults = await subscriptionDetectionService.detectSubscriptions();
    console.log(`\n✅ Subscription detection complete:`);
    console.log(`   - Patterns analyzed: ${subscriptionResults.patternsAnalyzed}`);
    console.log(`   - Suggestions created: ${subscriptionResults.suggestionsCreated}`);

    // Show pending subscription suggestions
    const pendingSubscriptions = await subscriptionDetectionService.getPendingSuggestions();
    if (pendingSubscriptions.length > 0) {
      console.log(`\n📋 Pending subscription suggestions (${pendingSubscriptions.length}):`);
      for (const suggestion of pendingSubscriptions.slice(0, 5)) {
        console.log(
          `   - "${suggestion.businessName}" - ${suggestion.frequency} - ${(suggestion as any).occurrenceCount} occurrences - ${suggestion.detectedAmount} ILS`
        );
      }
      if (pendingSubscriptions.length > 5) {
        console.log(`   ... and ${pendingSubscriptions.length - 5} more`);
      }
    } else {
      console.log(`\n✓ No pending subscription suggestions`);
    }

    console.log('\n✅ Suggestion system test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

testSuggestions();
