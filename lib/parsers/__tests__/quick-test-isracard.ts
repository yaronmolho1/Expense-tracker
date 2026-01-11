/**
 * Quick test - Parse a single Isracard file and show results
 * Usage: npx tsx lib/parsers/__tests__/quick-test-isracard.ts [filename]
 */

import { IscracardParser } from '../isracard-parser';
import * as path from 'path';

async function main() {
  const fileName = process.argv[2] || '8041_07_2025.xlsx';

  console.log(`\n📄 Parsing: ${fileName}\n`);

  const parser = new IscracardParser(fileName);
  const filePath = path.join(
    __dirname,
    '../../../uploads/Use cases/Isracard-AMEX',
    fileName
  );

  try {
    const result = await parser.parse(filePath);

    console.log('✅ Metadata:');
    console.log(`   Card: ${result.metadata.cardLast4}`);
    console.log(`   Month: ${result.metadata.statementMonth}`);
    console.log(`   Total: ₪${result.metadata.totalAmount?.toFixed(2) || 'N/A'}\n`);

    console.log(`✅ Parsed ${result.transactions.length} transactions\n`);

    // Show first 10 transactions
    console.log('📋 Transactions:\n');
    result.transactions.slice(0, 10).forEach((tx, i) => {
      console.log(`${i + 1}. ${tx.businessName}`);
      console.log(`   ${tx.dealDate.toISOString().split('T')[0]} | ₪${tx.chargedAmountIls.toFixed(2)}`);

      if (tx.paymentType === 'installments') {
        console.log(`   💳 Installment ${tx.installmentIndex}/${tx.installmentTotal}`);
      }
      if (tx.isSubscription) {
        console.log(`   🔄 Subscription`);
      }
      if (tx.originalCurrency !== 'ILS') {
        console.log(`   🌍 ${tx.originalAmount.toFixed(2)} ${tx.originalCurrency}`);
      }
      console.log('');
    });

    if (result.transactions.length > 10) {
      console.log(`... and ${result.transactions.length - 10} more transactions\n`);
    }

    // Summary
    const installments = result.transactions.filter(t => t.paymentType === 'installments').length;
    const subscriptions = result.transactions.filter(t => t.isSubscription).length;
    const foreign = result.transactions.filter(t => t.originalCurrency !== 'ILS').length;

    console.log('📊 Summary:');
    console.log(`   Installments: ${installments}`);
    console.log(`   Subscriptions: ${subscriptions}`);
    console.log(`   Foreign: ${foreign}`);
    console.log(`   Errors: ${result.errors?.length || 0}`);
    console.log(`   Warnings: ${result.warnings?.length || 0}`);

  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
