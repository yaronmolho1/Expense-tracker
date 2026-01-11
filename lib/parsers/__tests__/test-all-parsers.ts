/**
 * Main Test Runner for All Parsers
 *
 * Tests all three credit card statement parsers:
 * - Isracard/AMEX (16 files)
 * - VISA/CAL (6 files)
 * - MAX (8 files)
 *
 * Run with: npx ts-node expense-tracker/lib/parsers/__tests__/test-all-parsers.ts
 */

import path from 'path';
import fs from 'fs';
import { IscracardParser } from '../isracard-parser';
import { VisaCalParser } from '../visa-cal-parser';
import { MaxParser } from '../max-parser';
import { BaseParser, ParserResult, ParsedTransaction } from '../base-parser';

// ============================================
// CONFIGURATION
// ============================================

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'use cases');

const TEST_FILES = {
  isracard: [
    'isracard 1.xlsx',
    'isracard 2.xlsx',
    'isracard 3.xlsx',
    'isracard 4.xlsx',
    'isracard 5.xlsx',
    'isracard 6.xlsx',
    'isracard 7.xlsx',
    'isracard 8.xlsx',
    'isracard 9.xlsx',
    'isracard 10.xlsx',
    'isracard 11.xlsx',
    'isracard 12.xlsx',
    'isracard 13.xlsx',
    'isracard 14.xlsx',
    'isracard 15.xlsx',
    'isracard 16.xlsx',
  ],
  visaCal: [
    'visa 1.xlsx',
    'visa 2.xlsx',
    'visa 3.xlsx',
    'visa 4.xlsx',
    'visa 5.xlsx',
    'visa 6.xlsx',
  ],
  max: [
    'max 1.xlsx',
    'max 2.xlsx',
    'max 3.xlsx',
    'max 4.xlsx',
    'max 5.xlsx',
    'max 6.xlsx',
    'max 7.xlsx',
    'max 8.xlsx',
  ],
};

// ============================================
// UTILITIES
// ============================================

interface TestStats {
  totalFiles: number;
  successfulParsing: number;
  failedParsing: number;
  totalTransactions: number;
  installments: number;
  subscriptions: number;
  refunds: number;
  foreignCurrency: number;
}

function initStats(): TestStats {
  return {
    totalFiles: 0,
    successfulParsing: 0,
    failedParsing: 0,
    totalTransactions: 0,
    installments: 0,
    subscriptions: 0,
    refunds: 0,
    foreignCurrency: 0,
  };
}

function updateStats(stats: TestStats, result: ParserResult): void {
  stats.totalTransactions += result.transactions.length;

  result.transactions.forEach((tx) => {
    if (tx.paymentType === 'installments') stats.installments++;
    if (tx.isSubscription) stats.subscriptions++;
    if (tx.isRefund) stats.refunds++;
    if (tx.originalCurrency !== 'ILS') stats.foreignCurrency++;
  });
}

function printStats(parserName: string, stats: TestStats): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${parserName} - SUMMARY STATISTICS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Files:            ${stats.totalFiles}`);
  console.log(`Successful Parsing:     ${stats.successfulParsing}`);
  console.log(`Failed Parsing:         ${stats.failedParsing}`);
  console.log(`Total Transactions:     ${stats.totalTransactions}`);
  console.log(`Installments:           ${stats.installments}`);
  console.log(`Subscriptions:          ${stats.subscriptions}`);
  console.log(`Refunds:                ${stats.refunds}`);
  console.log(`Foreign Currency:       ${stats.foreignCurrency}`);
  console.log(`${'='.repeat(60)}\n`);
}

function printResult(fileName: string, result: ParserResult, fileIndex: number): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[${fileIndex}] ${fileName}`);
  console.log(`${'─'.repeat(60)}`);

  // Metadata
  console.log(`\n📋 METADATA:`);
  console.log(`  Card Last 4:      ${result.metadata.cardLast4}`);
  console.log(`  Statement Month:  ${result.metadata.statementMonth}`);
  console.log(`  Statement Date:   ${result.metadata.statementDate?.toISOString().split('T')[0] || 'N/A'}`);
  console.log(`  Total Amount:     ${result.metadata.totalAmount?.toFixed(2) || 'N/A'} ILS`);

  // Transactions
  console.log(`\n💳 TRANSACTIONS: ${result.transactions.length} total`);

  if (result.transactions.length > 0) {
    // Show first 3 transactions
    const sampleSize = Math.min(3, result.transactions.length);
    console.log(`\n  Sample (first ${sampleSize}):`);

    for (let i = 0; i < sampleSize; i++) {
      const tx = result.transactions[i];
      console.log(`\n  [${i + 1}] ${tx.businessName}`);
      console.log(`      Deal Date:        ${tx.dealDate.toISOString().split('T')[0]}`);
      console.log(`      Amount:           ${tx.originalAmount.toFixed(2)} ${tx.originalCurrency}`);
      console.log(`      Charged (ILS):    ${tx.chargedAmountIls.toFixed(2)}`);
      console.log(`      Payment Type:     ${tx.paymentType}`);
      if (tx.installmentIndex && tx.installmentTotal) {
        console.log(`      Installment:      ${tx.installmentIndex}/${tx.installmentTotal}`);
      }
      console.log(`      Subscription:     ${tx.isSubscription ? 'YES' : 'NO'}`);
      console.log(`      Refund:           ${tx.isRefund ? 'YES' : 'NO'}`);
      if (tx.exchangeRateUsed) {
        console.log(`      Exchange Rate:    ${tx.exchangeRateUsed.toFixed(4)}`);
      }
    }
  }

  // Errors
  if (result.errors && result.errors.length > 0) {
    console.log(`\n❌ ERRORS: ${result.errors.length}`);
    result.errors.forEach((err, idx) => {
      console.log(`  [${idx + 1}] Row ${err.row}: ${err.message}`);
    });
  }

  // Warnings
  if (result.warnings && result.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS: ${result.warnings.length}`);
    result.warnings.forEach((warn, idx) => {
      console.log(`  [${idx + 1}] Row ${warn.row}: ${warn.message}`);
    });
  }
}

// ============================================
// TEST RUNNERS
// ============================================

async function testParser(
  parserName: string,
  fileNames: string[],
  ParserClass: new (fileName: string) => BaseParser
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TESTING ${parserName.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);

  const stats = initStats();

  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i];
    const filePath = path.join(UPLOADS_DIR, fileName);

    stats.totalFiles++;

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`\n❌ File not found: ${fileName}`);
      stats.failedParsing++;
      continue;
    }

    try {
      // Create parser instance
      const parser = new ParserClass(fileName);

      // Test canParse()
      const canParse = await parser.canParse(filePath);

      if (!canParse) {
        console.log(`\n⚠️  Parser cannot handle: ${fileName}`);
        stats.failedParsing++;
        continue;
      }

      // Test parse()
      const result = await parser.parse(filePath);

      // Update stats
      stats.successfulParsing++;
      updateStats(stats, result);

      // Print results
      printResult(fileName, result, i + 1);

    } catch (error) {
      console.log(`\n❌ Error parsing ${fileName}:`);
      console.log(`   ${error instanceof Error ? error.message : String(error)}`);
      stats.failedParsing++;
    }
  }

  // Print summary
  printStats(parserName, stats);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n🧪 CREDIT CARD STATEMENT PARSER - TEST SUITE');
  console.log(`📁 Uploads directory: ${UPLOADS_DIR}\n`);

  // Test Isracard/AMEX
  await testParser('ISRACARD/AMEX', TEST_FILES.isracard, IscracardParser);

  // Test VISA/CAL
  await testParser('VISA/CAL', TEST_FILES.visaCal, VisaCalParser);

  // Test MAX
  await testParser('MAX', TEST_FILES.max, MaxParser);

  console.log('\n✅ ALL TESTS COMPLETED\n');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
