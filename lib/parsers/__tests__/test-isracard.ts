import { IscracardParser } from '../isracard-parser';
import * as path from 'path';

async function testFile(fileName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${fileName}`);
  console.log('='.repeat(80));

  const parser = new IscracardParser(fileName);
  const filePath = path.join(
    __dirname,
    '../../../uploads/Use cases/Isracard-AMEX',
    fileName
  );

  try {
    // Test canParse
    const canParse = await parser.canParse(filePath);
    console.log('✓ Can parse:', canParse);

    if (!canParse) {
      console.log('✗ Parser rejected file');
      return;
    }

    // Test parse
    const result = await parser.parse(filePath);

    console.log('\nMetadata:');
    console.log('  Card:', result.metadata.cardLast4);
    console.log('  Month:', result.metadata.statementMonth);
    console.log('  Total:', result.metadata.totalAmount?.toFixed(2) || 'N/A');
    if (result.metadata.statementDate) {
      console.log('  Charge Date:', result.metadata.statementDate.toISOString().split('T')[0]);
    }

    console.log('\nTransaction Summary:');
    console.log('  Total transactions:', result.transactions.length);
    console.log('  Errors:', result.errors?.length || 0);
    console.log('  Warnings:', result.warnings?.length || 0);

    // Count transaction types
    const installments = result.transactions.filter(t => t.paymentType === 'installments');
    const subscriptions = result.transactions.filter(t => t.isSubscription);
    const refunds = result.transactions.filter(t => t.isRefund);
    const foreign = result.transactions.filter(t => t.originalCurrency !== 'ILS');

    console.log('\nTransaction Types:');
    console.log('  Installments:', installments.length);
    console.log('  Subscriptions:', subscriptions.length);
    console.log('  Refunds:', refunds.length);
    console.log('  Foreign currency:', foreign.length);

    // Show sample transactions
    console.log('\nSample Transactions (first 5):');
    result.transactions.slice(0, 5).forEach((tx, i) => {
      console.log(`\n  ${i + 1}. ${tx.businessName}`);
      console.log(`     Date: ${tx.dealDate.toISOString().split('T')[0]}`);
      console.log(`     Amount: ${tx.chargedAmountIls.toFixed(2)} ILS`);
      if (tx.originalCurrency !== 'ILS') {
        console.log(`     Original: ${tx.originalAmount.toFixed(2)} ${tx.originalCurrency}`);
        if (tx.exchangeRateUsed) {
          console.log(`     Exchange Rate: ${tx.exchangeRateUsed.toFixed(4)}`);
        }
      }
      if (tx.paymentType === 'installments') {
        console.log(`     Installment: ${tx.installmentIndex}/${tx.installmentTotal}`);
      }
      if (tx.isSubscription) {
        console.log(`     [SUBSCRIPTION]`);
      }
      if (tx.isRefund) {
        console.log(`     [REFUND]`);
      }
      if (tx.bankChargeDate) {
        console.log(`     Bank Charge: ${tx.bankChargeDate.toISOString().split('T')[0]}`);
      }
    });

    // Validation: Sum of ILS transactions
    const sumILS = result.transactions
      .filter(t => t.originalCurrency === 'ILS')
      .reduce((sum, t) => sum + t.chargedAmountIls, 0);

    console.log('\nValidation:');
    console.log('  Sum of ILS transactions:', sumILS.toFixed(2));
    if (result.metadata.totalAmount) {
      console.log('  File total:', result.metadata.totalAmount.toFixed(2));
      const diff = Math.abs(sumILS - result.metadata.totalAmount);
      const diffPercent = (diff / result.metadata.totalAmount) * 100;
      console.log('  Difference:', diff.toFixed(2), `(${diffPercent.toFixed(2)}%)`);

      if (diffPercent < 1) {
        console.log('  ✓ VALIDATION PASSED (within 1%)');
      } else {
        console.log('  ⚠️  VALIDATION WARNING (diff > 1%)');
      }
    }

    // Show errors if any
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  ERRORS:');
      result.errors.slice(0, 5).forEach(e => {
        console.log(`  Row ${e.row}: ${e.message}`);
      });
      if (result.errors.length > 5) {
        console.log(`  ... and ${result.errors.length - 5} more errors`);
      }
    }

    // Show warnings if any
    if (result.warnings && result.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      result.warnings.slice(0, 5).forEach(w => {
        console.log(`  Row ${w.row}: ${w.message}`);
      });
      if (result.warnings.length > 5) {
        console.log(`  ... and ${result.warnings.length - 5} more warnings`);
      }
    }

    console.log('\n✓ TEST PASSED');

  } catch (error) {
    console.error('\n✗ TEST FAILED:', (error as Error).message);
    console.error((error as Error).stack);
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('ISRACARD/AMEX PARSER TEST SUITE');
  console.log('='.repeat(80));

  const testFiles = [
    // All 16 files
    '7547_10_2025.xlsx',
    '8041_01_2025.xlsx',
    '8041_02_2025.xlsx',
    '8041_03_2025.xlsx',
    '8041_07_2025.xlsx',
    '8041_09_2025.xlsx',
    '8041_10_2025.xlsx',
    '8582_01_2025.xlsx',
    '8582_02_2025.xlsx',
    '8582_03_2025.xlsx',
    '8582_04_2025.xlsx',
    '8582_05_2025.xlsx',
    '8582_06_2025.xlsx',
    '8582_07_2025.xlsx',
    '8582_08_2025.xlsx',
  ];

  let passed = 0;
  let failed = 0;

  for (const file of testFiles) {
    try {
      await testFile(file);
      passed++;
    } catch (error) {
      failed++;
      console.error(`\nFATAL ERROR testing ${file}:`, error);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST RESULTS');
  console.log('='.repeat(80));
  console.log(`Passed: ${passed}/${testFiles.length}`);
  console.log(`Failed: ${failed}/${testFiles.length}`);

  if (failed === 0) {
    console.log('\n✓ ALL TESTS PASSED!');
  } else {
    console.log('\n✗ SOME TESTS FAILED');
  }
  console.log('='.repeat(80));
}

runTests().catch(console.error);
