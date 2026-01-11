import { MaxParser } from '../max-parser';
import * as path from 'path';

async function testFile(fileName: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${fileName}`);
  console.log('='.repeat(70));

  const parser = new MaxParser(fileName);
  const filePath = path.join(__dirname, '../../../uploads/Use cases/MAX', fileName);

  try {
    // Test canParse
    const canParse = await parser.canParse(filePath);
    console.log('✓ Can parse:', canParse);

    if (!canParse) {
      console.log('✗ Parser rejected file');
      return { success: false, fileName };
    }

    // Test parse
    const result = await parser.parse(filePath);

    console.log('\n--- METADATA ---');
    console.log('  Card:', result.metadata.cardLast4);
    console.log('  Period:', result.metadata.statementMonth);
    console.log('  Sheets:', (result.metadata as any).sheetNames?.join(', '));
    console.log('  Total Sheets:', (result.metadata as any).totalSheets);

    console.log('\n--- TRANSACTIONS ---');
    console.log('  Total:', result.transactions.length);

    // Group by sheet
    const bySheet = result.transactions.reduce(
      (acc, tx) => {
        const sheet = (tx.rawRow as any)?.sheetName || 'unknown';
        acc[sheet] = (acc[sheet] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log('\n--- BY SHEET ---');
    Object.entries(bySheet).forEach(([sheet, count]) => {
      console.log(`  ${sheet}: ${count}`);
    });

    // Statistics
    const stats = {
      total: result.transactions.length,
      one_time: result.transactions.filter((t) => t.paymentType === 'one_time').length,
      installments: result.transactions.filter((t) => t.paymentType === 'installments').length,
      subscriptions: result.transactions.filter((t) => t.isSubscription).length,
      refunds: result.transactions.filter((t) => t.isRefund).length,
      foreignCurrency: result.transactions.filter((t) => t.originalCurrency !== 'ILS').length,
      pending: result.transactions.filter((t) =>
        (t.rawRow as any)?.sheetName?.includes('טרם נקלטו')
      ).length,
    };

    console.log('\n--- STATISTICS ---');
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    // Validate required fields
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
      console.log('\n⚠️  Invalid transactions:', invalidTxs.length);
      console.log('Sample:', invalidTxs[0]);
      return { success: false, fileName, errors: invalidTxs };
    }

    // Check for errors and warnings
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  ERRORS:', result.errors.length);
      result.errors.forEach((err) => {
        console.log(`  Row ${err.row}: ${err.message}`);
      });
    }

    if (result.warnings && result.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:', result.warnings.length);
      result.warnings.slice(0, 3).forEach((warn) => {
        console.log(`  Row ${warn.row}: ${warn.message}`);
      });
    }

    // Sample transactions
    console.log('\n--- SAMPLE TRANSACTIONS ---');
    result.transactions.slice(0, 3).forEach((tx, i) => {
      console.log(`  ${i + 1}. ${tx.businessName}`);
      console.log(`     ${tx.chargedAmountIls} ${tx.originalCurrency}`);
      console.log(`     Date: ${tx.dealDate.toISOString().split('T')[0]}`);
      console.log(`     Type: ${tx.paymentType}`);
      if (tx.paymentType === 'installments') {
        console.log(`     Installment: ${tx.installmentIndex}/${tx.installmentTotal}`);
      }
      if (tx.isSubscription) console.log(`     [SUBSCRIPTION]`);
      if (tx.isRefund) console.log(`     [REFUND]`);
      if (tx.exchangeRateUsed) console.log(`     Exchange: ${tx.exchangeRateUsed}`);
      console.log(`     Source: ${tx.sourceFileName}`);
    });

    console.log('\n✅ SUCCESS');
    return { success: true, fileName, stats };
  } catch (error) {
    console.error('\n❌ FAILED:', error);
    return { success: false, fileName, error };
  }
}

async function testRejection() {
  console.log(`\n${'='.repeat(70)}`);
  console.log('Testing Rejection of Other File Types');
  console.log('='.repeat(70));

  const parser = new MaxParser('test.xlsx');

  // Test Isracard files
  const isracardFile = path.join(
    __dirname,
    '../../../uploads/Use cases/Isracard-AMEX/8041_07_2025.xlsx'
  );
  try {
    const shouldReject1 = await parser.canParse(isracardFile);
    console.log('✓ Rejects Isracard:', !shouldReject1);
  } catch {
    console.log('✓ Rejects Isracard: true (error thrown)');
  }

  // Test VISA files
  const visaFile = path.join(
    __dirname,
    '../../../uploads/Use cases/VISA-CAL/פירוט חיובים לכרטיס ויזה 2446 - 05.08.25.xlsx'
  );
  try {
    const shouldReject2 = await parser.canParse(visaFile);
    console.log('✓ Rejects VISA:', !shouldReject2);
  } catch {
    console.log('✓ Rejects VISA: true (error thrown)');
  }
}

async function runTests() {
  const testFiles = [
    '01.25 - 7229.xlsx',
    '02.25 - 7229.xlsx',
    '03.25 - 7229.xlsx',
    '04.25 - 7229.xlsx',
    '05.25 - 7229.xlsx',
    '06.25 - 7229.xlsx',
    '07.25 - 7229.xlsx',
    '08.25 - 7229.xlsx',
  ];

  const results = [];

  for (const file of testFiles) {
    const result = await testFile(file);
    results.push(result);
  }

  // Test rejection
  await testRejection();

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\nTotal files tested: ${results.length}`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed files:');
    failed.forEach((f) => {
      console.log(`  - ${f.fileName}`);
    });
  }

  // Aggregate statistics
  if (successful.length > 0) {
    console.log('\n--- AGGREGATE STATISTICS ---');
    const totalStats = successful.reduce(
      (acc, r) => {
        if (r.stats) {
          Object.keys(r.stats).forEach((key) => {
            acc[key] = (acc[key] || 0) + ((r.stats as any)[key] as number);
          });
        }
        return acc;
      },
      {} as Record<string, number>
    );

    Object.entries(totalStats).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log(failed.length === 0 ? '🎉 ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
