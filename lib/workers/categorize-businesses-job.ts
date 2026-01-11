import { Job } from 'pg-boss';
import { categorizationService } from '../services/categorization-service';
import logger from '@/lib/logger';

/**
 * Background job to categorize businesses using LLM
 *
 * This job is triggered automatically after batch uploads complete.
 * It processes up to 50 uncategorized businesses per run.
 */
export async function categorizateBusinessesJob(job: Job<{ batchId?: number }>) {
  logger.info({ jobId: job.id, batchId: job.data?.batchId }, 'Categorize businesses job started');

  try {
    const result = await categorizationService.categorizeUncategorizedBusinesses(job.data?.batchId);

    logger.info({ jobId: job.id, ...result }, 'Categorize businesses job completed');

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    logger.error(error, 'Categorize businesses job failed');
    throw error; // pg-boss will retry
  }
}

/**
 * Job configuration
 */
export const CATEGORIZE_BUSINESSES_JOB_NAME = 'categorize-businesses';

export const CATEGORIZE_BUSINESSES_JOB_OPTIONS = {
  retryLimit: 2, // Retry twice on failure
  retryDelay: 60, // Wait 60 seconds between retries
  expireInHours: 1, // Job expires after 1 hour
};
