import type { Job } from 'pg-boss';
import { suggestionService } from '../services/suggestion-service';
import logger from '@/lib/logger';

/**
 * Background job: Detect potential business merge suggestions
 * Runs weekly to find businesses with similar names that might be duplicates
 */
export async function detectBusinessMergesJob(job: Job) {
  logger.info({ jobId: job.id }, 'Detect business merges job started');

  try {
    const result = await suggestionService.detectBusinessMerges();

    logger.info({ jobId: job.id, ...result }, 'Detect business merges job completed');
    return { success: true, ...result };
  } catch (error) {
    logger.error(error, 'Detect business merges job failed');
    throw error;
  }
}

export const DETECT_BUSINESS_MERGES_JOB_NAME = 'detect-business-merges';
export const DETECT_BUSINESS_MERGES_JOB_OPTIONS = {
  retryLimit: 2,
  retryDelay: 300, // 5 minutes
  expireInHours: 24,
};
