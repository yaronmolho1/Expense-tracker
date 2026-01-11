import type { Job } from 'pg-boss';
import { subscriptionDetectionService } from '../services/subscription-detection-service';
import logger from '@/lib/logger';

/**
 * Background job: Detect potential subscription patterns
 * Runs weekly to find recurring charges that might be subscriptions
 */
export async function detectSubscriptionsJob(job: Job) {
  logger.info({ jobId: job.id }, 'Detect subscriptions job started');

  try {
    const result = await subscriptionDetectionService.detectSubscriptions();

    logger.info({ jobId: job.id, ...result }, 'Detect subscriptions job completed');
    return { success: true, ...result };
  } catch (error) {
    logger.error(error, 'Detect subscriptions job failed');
    throw error;
  }
}

export const DETECT_SUBSCRIPTIONS_JOB_NAME = 'detect-subscriptions';
export const DETECT_SUBSCRIPTIONS_JOB_OPTIONS = {
  retryLimit: 2,
  retryDelay: 300, // 5 minutes
  expireInHours: 24,
};
