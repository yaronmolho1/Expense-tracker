import { db } from '@/lib/db';
import { uploadBatches, uploadedFiles, transactions, businesses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { VisaCalParser } from '@/lib/parsers/visa-cal-parser';
import { IscracardParser } from '@/lib/parsers/isracard-parser';
import { MaxParser } from '@/lib/parsers/max-parser';
import {
  generateTransactionHash,
  generateInstallmentGroupId,
  generateInstallmentTransactionHash,
} from '@/lib/utils/hash';
import { toTitleCase } from '@/lib/utils/string';
import {
  createInstallmentGroup,
  createInstallmentGroupFromMiddle,
  findAnyTransactionInGroup,
  matchInstallmentPayment,
  completeProjectedInstallment,
} from '@/lib/services/installment-service';
import { convertToILS } from '@/lib/services/exchange-rate-service';
import { SubscriptionDetectionService } from '@/lib/services/subscription-detection-service';
import { getPgBoss } from '@/lib/workers/pg-boss-client';
import { CATEGORIZE_BUSINESSES_JOB_NAME } from '@/lib/workers/categorize-businesses-job';
import type { ParsedTransaction, ParseError } from '@/lib/parsers/base-parser';
import logger from '@/lib/logger';

export interface ProcessBatchJobData {
  batchId: number;
}

export async function processBatchJob(jobData: ProcessBatchJobData) {
  const { batchId } = jobData;

  logger.info({ batchId }, 'Starting batch processing');

  try {
    // Update batch status to 'processing'
    await db.update(uploadBatches)
      .set({ 
        status: 'processing',
        processingStartedAt: new Date(),
      })
      .where(eq(uploadBatches.id, batchId));

    // Load all files for this batch (only files with valid cardId)
    const allFiles = await db.query.uploadedFiles.findMany({
      where: eq(uploadedFiles.uploadBatchId, batchId),
    });

    // Filter out files without card assignment (validation failed)
    const files = allFiles.filter(f => f.cardId !== null && f.status === 'pending');

    // Load cards separately for type safety
    const cardIds = files.map(f => f.cardId).filter(Boolean) as number[];
    const cardsData = await db.query.cards.findMany({
      where: (cards, { inArray }) => inArray(cards.id, cardIds),
    });
    const cardsMap = new Map(cardsData.map(c => [c.id, c]));

    let totalTransactions = 0; // Total transactions created/updated in database
    let parsedTransactionCount = 0; // Total transactions found in files (including duplicates)
    let newTransactions = 0;
    let updatedTransactions = 0;
    let duplicateTransactions = 0;
    let totalAmountIls = 0; // Sum of amounts from actual file transactions only

    // Process each file
    for (const file of files) {
      logger.info({ filename: file.filename, batchId }, 'Processing file');

      try {
        // Get card info
        const card = file.cardId ? cardsMap.get(file.cardId) : null;
        if (!card) {
          throw new Error(`Card not found for file ${file.filename}`);
        }

        // Select parser based on card file format handler
        const parser = selectParser(card.fileFormatHandler || 'unknown', file.filename);

        // Parse the file
        const parseResult = await parser.parse(file.filePath);

        if (parseResult.errors && parseResult.errors.length > 0) {
          throw new Error(`Parse failed: ${parseResult.errors.map((e: ParseError) => e.message).join('; ')}`);
        }

        // Log sum validation and save warning if needed
        let validationWarning: string | null = null;
        if (parseResult.validation) {
          const { expectedTotal, calculatedTotal, difference, isValid } = parseResult.validation;
          if (expectedTotal !== undefined) {
            logger.info({
              filename: file.filename,
              expectedTotal,
              calculatedTotal: calculatedTotal.toFixed(2),
              difference: difference?.toFixed(2),
              transactionCount: parseResult.transactions.length,
              isValid,
            }, 'Sum validation');
            if (!isValid) {
              logger.warn({
                filename: file.filename,
                expectedTotal,
                calculatedTotal,
                difference,
              }, 'Sum mismatch exceeds tolerance');
              validationWarning = `Sum mismatch: Expected ${expectedTotal} ILS but calculated ${calculatedTotal.toFixed(2)} ILS (difference: ${difference?.toFixed(2)} ILS)`;
            }
          }
        }

        // Process each transaction
        for (const parsedTx of parseResult.transactions) {
          parsedTransactionCount++; // Count every transaction from file
          
          // Get or create business
          const business = await getOrCreateBusiness(parsedTx.businessName);

          const dealDateStr = parsedTx.dealDate.toISOString().split('T')[0]; // YYYY-MM-DD

          // Handle currency conversion for foreign transactions
          let finalAmountIls = parsedTx.chargedAmountIls;
          let finalExchangeRate = parsedTx.exchangeRateUsed || null;

          if (parsedTx.originalCurrency !== 'ILS' && !parsedTx.exchangeRateUsed) {
            // Parser didn't provide exchange rate - lookup from our service
            const conversionResult = await convertToILS(
              parsedTx.originalAmount,
              parsedTx.originalCurrency,
              parsedTx.dealDate
            );

            if (conversionResult) {
              finalAmountIls = conversionResult.amountILS;
              finalExchangeRate = conversionResult.rate;
              logger.info({
                originalAmount: parsedTx.originalAmount,
                originalCurrency: parsedTx.originalCurrency,
                convertedAmount: finalAmountIls.toFixed(2),
                rate: finalExchangeRate,
              }, 'Currency converted');
            } else {
              // Rate not found - log warning and use parser's ILS value
              logger.warn({
                currency: parsedTx.originalCurrency,
                date: dealDateStr,
                amountUsed: finalAmountIls,
              }, 'Exchange rate not found, using parser value');
            }
          }

          // Check if this is an installment
          const isInstallment = parsedTx.paymentType === 'installments' && parsedTx.installmentTotal && parsedTx.installmentIndex;
          const isSubscription = parsedTx.paymentType === 'subscription' || parsedTx.isSubscription;

          if (isInstallment) {
            // The charge date from parsing IS the original purchase date (payment 1 date)
            // For payment N on date D: payment 1 = D, payment 2 = D+30, payment 3 = D+60, etc.
            const originalPurchaseDateStr = dealDateStr;

            // Calculate group ID using original purchase date
            const totalPaymentSum = finalAmountIls * parsedTx.installmentTotal!;
            const groupId = generateInstallmentGroupId({
              businessNormalizedName: business.normalizedName,
              totalPaymentSum,
              installmentTotal: parsedTx.installmentTotal!,
              dealDate: originalPurchaseDateStr, // Use original purchase date, not charge date
            });

            // Check if this installment group already exists
            const existingInGroup = await findAnyTransactionInGroup(groupId);

            if (!existingInGroup) {
              // CASE 1: First time seeing this installment group
              if (parsedTx.installmentIndex === 1) {
                // Normal case: payment 1/N
                logger.info({
                  businessName: parsedTx.businessName,
                  installmentIndex: parsedTx.installmentIndex,
                  installmentTotal: parsedTx.installmentTotal,
                }, 'Creating installment group from payment 1');

                await createInstallmentGroup({
                  firstTransactionData: {
                    businessId: business.id,
                    businessNormalizedName: business.normalizedName,
                    cardId: card.id,
                    dealDate: originalPurchaseDateStr, // Use calculated original purchase date
                    originalAmount: parsedTx.originalAmount,
                    originalCurrency: parsedTx.originalCurrency,
                    exchangeRateUsed: finalExchangeRate,
                    chargedAmountIls: finalAmountIls,
                    sourceFile: file.filename,
                    uploadBatchId: batchId,
                  },
                  installmentInfo: {
                    index: parsedTx.installmentIndex!,
                    total: parsedTx.installmentTotal!,
                    amount: finalAmountIls,
                  },
                });
              } else {
                // Backfill case: payment N/X where N > 1
                logger.info({
                  businessName: parsedTx.businessName,
                  installmentIndex: parsedTx.installmentIndex,
                  installmentTotal: parsedTx.installmentTotal,
                }, 'Creating installment group with backfill');

                await createInstallmentGroupFromMiddle({
                  firstTransactionData: {
                    businessId: business.id,
                    businessNormalizedName: business.normalizedName,
                    cardId: card.id,
                    dealDate: originalPurchaseDateStr, // Use calculated original purchase date
                    originalAmount: parsedTx.originalAmount,
                    originalCurrency: parsedTx.originalCurrency,
                    exchangeRateUsed: finalExchangeRate,
                    chargedAmountIls: finalAmountIls,
                    sourceFile: file.filename,
                    uploadBatchId: batchId,
                  },
                  installmentInfo: {
                    index: parsedTx.installmentIndex!,
                    total: parsedTx.installmentTotal!,
                    amount: finalAmountIls,
                  },
                });
              }

              // Count all created transactions
              newTransactions += parsedTx.installmentTotal!;
              totalTransactions += parsedTx.installmentTotal!;
              // Add only the single payment amount from the file (not all installments)
              totalAmountIls += finalAmountIls;

            } else {
              // CASE 2: Installment group exists - match to projected payment
              const expectedHash = generateInstallmentTransactionHash({
                installmentGroupId: groupId,
                installmentIndex: parsedTx.installmentIndex!,
              });

              const existingProjected = await matchInstallmentPayment(expectedHash);

              if (existingProjected && existingProjected.status === 'projected') {
                // Update projected → completed
                logger.info({
                  businessName: parsedTx.businessName,
                  installmentIndex: parsedTx.installmentIndex,
                  installmentTotal: parsedTx.installmentTotal,
                }, 'Matching installment payment');

                await completeProjectedInstallment(existingProjected.id, {
                  actualChargeDate: existingProjected.projectedChargeDate || dealDateStr,
                  chargedAmountIls: finalAmountIls,
                  exchangeRateUsed: finalExchangeRate,
                });

                updatedTransactions += 1;
                totalAmountIls += finalAmountIls;

              } else if (existingProjected && existingProjected.status === 'completed') {
                // Duplicate - already processed
                logger.debug({
                  hashPrefix: expectedHash.slice(0, 8),
                  businessName: parsedTx.businessName,
                }, 'Duplicate installment detected');
                duplicateTransactions++;

              } else {
                // No match found - should not happen if group exists
                logger.error(
                  new Error('Group exists but payment not found'),
                  `Installment payment mismatch: ${parsedTx.businessName} ${parsedTx.installmentIndex}/${parsedTx.installmentTotal}`
                );
              }
            }

          } else {
            // CASE 3: Non-installment transaction (regular one-time or subscription)
            const txHash = generateTransactionHash({
              normalizedBusinessName: business.normalizedName,
              dealDate: dealDateStr,
              chargedAmountIls: finalAmountIls,
              cardLast4: card.last4Digits,
              installmentIndex: parsedTx.installmentIndex || 0,
              paymentType: parsedTx.paymentType === 'one_time' ? 'regular' : parsedTx.paymentType,
              isRefund: parsedTx.isRefund,
            });

            // Check if transaction already exists
            const existingTx = await db.query.transactions.findFirst({
              where: eq(transactions.transactionHash, txHash),
            });

            if (existingTx) {
              // Duplicate - skip
              logger.debug({ hashPrefix: txHash.slice(0, 8) }, 'Skipping duplicate transaction');
              duplicateTransactions++;
              continue;
            }

            // Determine transaction type based on isSubscription flag
            const transactionType = isSubscription ? 'subscription' : 'one_time';

            // Insert new transaction
            await db.insert(transactions).values({
              businessId: business.id,
              originalBusinessId: business.id, // Track original business for merge/unmerge
              cardId: file.cardId!,
              transactionHash: txHash,
              transactionType,
              dealDate: dealDateStr,
              bankChargeDate: parsedTx.bankChargeDate?.toISOString().split('T')[0],
              chargedAmountIls: finalAmountIls.toString(),
              originalAmount: parsedTx.originalAmount.toString(),
              originalCurrency: parsedTx.originalCurrency,
              exchangeRateUsed: finalExchangeRate?.toString(),
              paymentType: 'one_time', // Subscriptions are one-time charges, not installments
              installmentIndex: parsedTx.installmentIndex,
              installmentTotal: parsedTx.installmentTotal,
              isRefund: parsedTx.isRefund,
              sourceFile: file.filename,
              uploadBatchId: batchId,
              status: 'completed',
              actualChargeDate: dealDateStr,
            });

            newTransactions++;
            totalTransactions++;
            totalAmountIls += finalAmountIls;
          }
        }

        // Update file status
        await db.update(uploadedFiles)
          .set({
            status: 'completed',
            validationWarning,
          })
          .where(eq(uploadedFiles.id, file.id));

      } catch (error) {
        logger.error(error, `File processing error: ${file.filename}`);
        
        // Update file with error
        await db.update(uploadedFiles)
          .set({ 
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(uploadedFiles.id, file.id));
      }
    }

    // Determine error message based on results
    // Status stays 'completed' - we use error_message field to show warnings
    let errorMessage: string | null = null;

    // If ALL transactions were duplicates
    if (parsedTransactionCount > 0 && newTransactions === 0 && updatedTransactions === 0 && duplicateTransactions === parsedTransactionCount) {
      errorMessage = `All ${duplicateTransactions} transaction${duplicateTransactions !== 1 ? 's' : ''} already exist in the system`;
    }
    // If SOME transactions were duplicates
    else if (duplicateTransactions > 0) {
      errorMessage = `${duplicateTransactions} duplicate transaction${duplicateTransactions !== 1 ? 's' : ''} found and skipped. ${newTransactions + updatedTransactions} transaction${newTransactions + updatedTransactions !== 1 ? 's were' : ' was'} processed.`;
    }

    // Update batch with final status
    await db.update(uploadBatches)
      .set({
        status: 'completed',
        totalTransactions,
        newTransactions,
        updatedTransactions,
        totalAmountIls: totalAmountIls.toFixed(2),
        errorMessage,
        processingCompletedAt: new Date(),
      })
      .where(eq(uploadBatches.id, batchId));

    logger.info({
      batchId,
      parsedTransactionCount,
      newTransactions,
      updatedTransactions,
      duplicateTransactions,
      totalTransactions,
      hasWarning: errorMessage !== null,
    }, 'Batch processing complete');

    // Trigger LLM categorization job for any new businesses
    try {
      const boss = await getPgBoss();
      await boss.send(CATEGORIZE_BUSINESSES_JOB_NAME, { batchId });
      logger.info({ batchId }, 'Triggered categorization job');
    } catch (error) {
      logger.error(error, 'Failed to trigger categorization job');
      // Don't fail the batch if categorization job fails to enqueue
    }

    // Run subscription detection after batch processing
    try {
      const detectionService = new SubscriptionDetectionService();
      const detectionResult = await detectionService.detectSubscriptions();
      logger.info({
        suggestionsCreated: detectionResult.suggestionsCreated,
        patternsAnalyzed: detectionResult.patternsAnalyzed,
      }, 'Subscription detection complete');
    } catch (error) {
      logger.error(error, 'Failed to run subscription detection');
      // Don't fail the batch if subscription detection fails
    }

  } catch (error) {
    logger.error(error, `Fatal error processing batch ${batchId}`);

    // Update batch with failure
    await db.update(uploadBatches)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processingCompletedAt: new Date(),
      })
      .where(eq(uploadBatches.id, batchId));

    throw error;
  }
}

// Helper: Select parser based on card issuer/file format handler
function selectParser(fileFormatHandler: string, filename: string) {
  switch (fileFormatHandler.toLowerCase()) {
    case 'isracard':
    case 'amex':
      return new IscracardParser(filename);
    case 'max':
      return new MaxParser(filename);
    case 'visa':
    case 'cal':
    case 'leumi':
    default:
      return new VisaCalParser(filename);
  }
}

// Helper: Get or create business by name
async function getOrCreateBusiness(businessName: string) {
  const normalizedName = businessName.toLowerCase().trim();

  // Check if business exists
  let business = await db.query.businesses.findFirst({
    where: eq(businesses.normalizedName, normalizedName),
  });

  if (!business) {
    // Create new business with title-cased display name
    const [newBusiness] = await db.insert(businesses).values({
      displayName: toTitleCase(businessName),
      normalizedName,
    }).returning();

    business = newBusiness;
  }

  // CRITICAL: Resolve merge chain if business has been merged
  // Follow mergedToId until we find the final target (where mergedToId is NULL)
  if (business?.mergedToId) {
    let finalBusiness = business;
    const visitedIds = new Set<number>([business.id]); // Prevent infinite loops

    while (finalBusiness?.mergedToId) {
      // Safety check: prevent infinite loops in case of circular references
      if (visitedIds.has(finalBusiness.mergedToId)) {
        logger.error(
          new Error('Circular merge detected'),
          `Circular merge chain: ${Array.from(visitedIds).join(' -> ')} -> ${finalBusiness.mergedToId}`
        );
        break;
      }

      visitedIds.add(finalBusiness.mergedToId);

      // Fetch the target business
      const targetBusiness = await db.query.businesses.findFirst({
        where: eq(businesses.id, finalBusiness.mergedToId),
      });

      if (!targetBusiness) {
        logger.error(
          new Error('Broken merge chain'),
          `Business ${finalBusiness.id} points to non-existent business ${finalBusiness.mergedToId}`
        );
        break;
      }

      finalBusiness = targetBusiness;
    }

    logger.debug({
      businessName,
      originalId: business.id,
      finalTargetId: finalBusiness?.id,
    }, 'Resolved business merge');
    business = finalBusiness;
  }

  return business!;
}