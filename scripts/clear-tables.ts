/**
 * Clear Database Tables (Interactive)
 * 
 * Allows selective clearing of tables with confirmation prompts.
 * USE WITH CAUTION - Data cannot be recovered!
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

const AVAILABLE_TABLES = [
  { name: 'transactions', description: 'All transactions (⚠️  deletes transaction data)' },
  { name: 'businesses', description: 'All businesses (⚠️  will cascade to transactions)' },
  { name: 'cards', description: 'All payment cards (⚠️  will cascade to transactions)' },
  { name: 'upload_batches', description: 'Upload history' },
  { name: 'uploaded_files', description: 'File upload records' },
  { name: 'subscriptions', description: 'Subscription records' },
  { name: 'business_merge_suggestions', description: 'Business merge suggestions' },
  { name: 'subscription_suggestions', description: 'Subscription suggestions' },
  { name: 'processing_logs', description: 'Processing logs' },
];

async function clearTable(tableName: string): Promise<number> {
  console.log(`\n🗑️  Clearing table: ${tableName}...`);
  
  const result = await db.execute(sql.raw(`
    TRUNCATE ${tableName} CASCADE;
  `));
  
  console.log(`✅ Cleared: ${tableName}`);
  return 0;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 DATABASE TABLE CLEARING UTILITY');
  console.log('='.repeat(60));
  console.log('\n⚠️  WARNING: This will permanently delete data!\n');

  // Show available tables
  console.log('Available tables:\n');
  AVAILABLE_TABLES.forEach((table, idx) => {
    console.log(`  ${idx + 1}. ${table.name.padEnd(30)} - ${table.description}`);
  });
  
  console.log('\nOptions:');
  console.log('  - Enter table numbers (e.g., "1,3,5")');
  console.log('  - Enter "all" to clear all tables');
  console.log('  - Enter "exit" to quit\n');

  const choice = await ask('Your selection: ');
  
  if (choice.toLowerCase() === 'exit') {
    console.log('\n👋 Cancelled.');
    rl.close();
    process.exit(0);
  }

  let tablesToClear: string[] = [];

  if (choice.toLowerCase() === 'all') {
    tablesToClear = AVAILABLE_TABLES.map(t => t.name);
  } else {
    const indices = choice.split(',').map(s => parseInt(s.trim()) - 1);
    tablesToClear = indices
      .filter(i => i >= 0 && i < AVAILABLE_TABLES.length)
      .map(i => AVAILABLE_TABLES[i].name);
  }

  if (tablesToClear.length === 0) {
    console.log('\n❌ No valid tables selected.');
    rl.close();
    process.exit(1);
  }

  // Show what will be cleared
  console.log('\n📋 Tables to be cleared:');
  tablesToClear.forEach(t => console.log(`  - ${t}`));
  
  const confirm = await ask('\n⚠️  Are you sure? Type "yes" to confirm: ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('\n👋 Cancelled.');
    rl.close();
    process.exit(0);
  }

  // Clear tables
  console.log('\n🚀 Starting...');
  for (const table of tablesToClear) {
    await clearTable(table);
  }

  console.log('\n✅ All done!\n');
  rl.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  rl.close();
  process.exit(1);
});
