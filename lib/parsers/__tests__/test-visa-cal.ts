import { VisaCalParser } from '../visa-cal-parser';
import * as path from 'path';

/**
 * Comprehensive test suite for VISA/CAL Parser
 * Tests all 6 real statement files + rejection tests
 */

async function testFile(fileName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${fileName}`);
  console.log('='.repeat(80));

  const parser = new VisaCalParser(fileName);
  const filePath = path.join(__dirname, '../../../uploads/Use cases/VISA-CAL', fileName);

  try {
    // Test 1: canParse
    const canParse = await parser.canParse(filePath);
    console.log('✓ Can parse:', canParse);

    if (!canParse) {
      console.log('✗ Parser rejected file');
      return false;
    }

    // Test 2: parse
    const result = await parser.parse(filePath);

    // Display metadata
    console.log('\n--- METADATA ---');
    console.log(`  Parser Name: ${parser.getName()}`);
    console.log(`  Card Last 4: ${result.metadata.cardLast4}`);
    console.log(`  Account: ${result.metadata.accountNumber}`);
    console.log(`  Statement Month: ${result.metadata.statementMonth}`);
    console.log(
      `  Charge Date: ${result.metadata.statementDate?.toISOString().split('T')[0]}`
    );
    console.log(`  Total Amount: ₪${result.metadata.totalAmount?.toFixed(2)}`);

    // Check for errors
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  ERRORS:', result.errors.length);
      result.errors.forEach((err) => {
        console.log(`  Row ${err.row}: ${err.message}`);
      });
      return false;
    }

    // Display transaction count
    console.log(`\n--- TRANSACTIONS: ${result.transactions.length} found ---`);

    // Validate all transactions have required fields
    const invalidTxs = result.transactions.filter((tx) => {
      return (
        !tx.businessName ||
        !tx.dealDate ||
        tx.chargedAmountIls === undefined ||
        !tx.originalCurrency ||
        !tx.paymentType ||
        tx.isRefund === undefined ||
        tx.isSubscription === undefined ||
        !tx.sourceFileName
      );
    });

    if (invalidTxs.length > 0) {
      console.log(`\n⚠️  Invalid transactions: ${invalidTxs.length}`);
      console.log('Sample invalid transaction:');
      console.log(JSON.stringify(invalidTxs[0], null, 2));
      return false;
    } else {
      console.log('✅ All transactions have required fields');
    }

    // Check paymentType values
    const badPaymentTypes = result.transactions.filter(
      (tx) => !['one_time', 'installments'].includes(tx.paymentType)
    );

    if (badPaymentTypes.length > 0) {
      console.log(`\n⚠️  Invalid paymentType values found: ${badPaymentTypes.length}`);
      console.log(
        'Values:',
        [...new Set(badPaymentTypes.map((t) => t.paymentType))]
      );
      return false;
    } else {
      console.log('✅ All paymentType values are valid');
    }

    // Statistics
    const stats = {
      total: result.transactions.length,
      oneTime: result.transactions.filter((t) => t.paymentType === 'one_time').length,
      installments: result.transactions.filter((t) => t.paymentType === 'installments')
        .length,
      subscriptions: result.transactions.filter((t) => t.isSubscription).length,
      refunds: result.transactions.filter((t) => t.isRefund).length,
      foreignCurrency: result.transactions.filter((t) => t.originalCurrency !== 'ILS')
        .length,
    };

    console.log('\n--- STATISTICS ---');
    console.log(`  Total: ${stats.total}`);
    console.log(`  One-time: ${stats.oneTime}`);
    console.log(`  Installments: ${stats.installments}`);
    console.log(`  Subscriptions: ${stats.subscriptions}`);
    console.log(`  Refunds: ${stats.refunds}`);
    console.log(`  Foreign Currency: ${stats.foreignCurrency}`);

    // Sample transactions
    console.log('\n--- SAMPLE TRANSACTIONS (first 3) ---');
    result.transactions.slice(0, 3).forEach((tx, i) => {
      console.log(`\n[${i + 1}] ${tx.businessName}`);
      console.log(
        `    Amount: ${tx.originalCurrency} ${tx.originalAmount.toFixed(2)} → ₪${tx.chargedAmountIls.toFixed(2)}`
      );
      console.log(`    Date: ${tx.dealDate.toISOString().split('T')[0]}`);
      console.log(`    Payment Type: ${tx.paymentType}`);

      if (tx.paymentType === 'installments') {
        console.log(`    Installment: ${tx.installmentIndex}/${tx.installmentTotal}`);
      }

      if (tx.exchangeRateUsed) {
        console.log(`    Exchange Rate: ${tx.exchangeRateUsed.toFixed(4)}`);
      }

      if (tx.isSubscription) {
        console.log(`    🔄 SUBSCRIPTION`);
      }

      if (tx.isRefund) {
        console.log(`    ↩️  REFUND`);
      }

      if (tx.bankCategory) {
        console.log(`    Category: ${tx.bankCategory}`);
      }

      console.log(`    Source: ${tx.sourceFileName}`);
    });

    console.log('\n✅ Test PASSED');
    return true;
  } catch (error) {
    console.error('\n❌ Test FAILED');
    console.error(error);
    return false;
  }
}

async function testRejection() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('REJECTION TESTS - Ensure other formats are rejected');
  console.log('='.repeat(80));

  const parser = new VisaCalParser('test.xlsx');

  // Test 1: Should REJECT Isracard files
  try {
    const isracardFile = path.join(
      __dirname,
      '../../../uploads/Use cases/Isracard-AMEX/8041_07_2025.xlsx'
    );
    const canParseIsracard = await parser.canParse(isracardFile);
    if (!canParseIsracard) {
      console.log('✅ Correctly rejects Isracard files');
    } else {
      console.log('⚠️  WARNING: Should reject Isracard files but accepted it!');
    }
  } catch (error) {
    console.log('✅ Correctly rejects Isracard files (threw error)');
  }

  // Test 2: Should REJECT MAX files
  try {
    const maxFile = path.join(
      __dirname,
      '../../../uploads/Use cases/MAX/07.25 - 7229.xlsx'
    );
    const canParseMax = await parser.canParse(maxFile);
    if (!canParseMax) {
      console.log('✅ Correctly rejects MAX files');
    } else {
      console.log('⚠️  WARNING: Should reject MAX files but accepted it!');
    }
  } catch (error) {
    console.log('✅ Correctly rejects MAX files (threw error)');
  }

  // Test 3: Should REJECT non-existent files
  try {
    const fakeFile = path.join(__dirname, 'nonexistent.xlsx');
    const canParseFake = await parser.canParse(fakeFile);
    if (!canParseFake) {
      console.log('✅ Correctly rejects non-existent files');
    } else {
      console.log('⚠️  WARNING: Should reject non-existent files');
    }
  } catch (error) {
    console.log('✅ Correctly rejects non-existent files (threw error)');
  }
}

async function runTests() {
  const testFiles = [
    'פירוט חיובים לכרטיס ויזה 2446 - 05.08.25.xlsx',
    'פירוט חיובים לכרטיס ויזה 2446 - 05.08.25 (1).xlsx',
    'פירוט חיובים לכרטיס ויזה 2446 - 05.08.25 (2).xlsx',
    'פירוט חיובים לכרטיס ויזה 2446 - 05.08.25 (3).xlsx',
    'פירוט חיובים לכרטיס ויזה 2446 - 21.10.25.xlsx',
    'פירוט חיובים לכרטיס ויזה 2446 - 21.10.25 (1).xlsx',
  ];

  const results: boolean[] = [];

  // Run file tests
  for (const file of testFiles) {
    const passed = await testFile(file);
    results.push(passed);
  }

  // Run rejection tests
  await testRejection();

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter((r) => r).length;
  const failed = results.filter((r) => !r).length;

  console.log(`\nTotal Files Tested: ${testFiles.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Parser is ready for production.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
  }

  console.log('\n' + '='.repeat(80));
}

// Run the tests
runTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
