import { getPgBoss, closePgBoss } from '../lib/workers/pg-boss-client';
import { processBatchJob, ProcessBatchJobData } from '../lib/workers/process-batch-job';
import { syncExchangeRates } from '../lib/workers/exchange-rate-sync-job';
import { categorizateBusinessesJob, CATEGORIZE_BUSINESSES_JOB_NAME } from '../lib/workers/categorize-businesses-job';
import { detectBusinessMergesJob, DETECT_BUSINESS_MERGES_JOB_NAME } from '../lib/workers/detect-business-merges-job';
import { detectSubscriptionsJob, DETECT_SUBSCRIPTIONS_JOB_NAME } from '../lib/workers/detect-subscriptions-job';

async function startWorker() {
  console.log('Starting pg-boss worker...');

  const boss = await getPgBoss();

  // Register process-batch job handler
  await boss.work('process-batch', async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Processing job ${job.id}:`, job.data);
      try {
        await processBatchJob(job.data as ProcessBatchJobData);
        console.log(`[Worker] Job ${job.id} completed successfully`);
      } catch (error) {
        console.error(`[Worker] Job ${job.id} failed:`, error);
        throw error; // Re-throw so pg-boss marks it as failed
      }
    }
  });

  // Register exchange rate sync job handler
  await boss.work('sync-exchange-rates', async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Running exchange rate sync job ${job.id}`);
      try {
        const result = await syncExchangeRates();
        console.log(`[Worker] Exchange rate sync completed:`, result);
      } catch (error) {
        console.error(`[Worker] Exchange rate sync failed:`, error);
        throw error;
      }
    }
  });

  // Create queue and schedule daily exchange rate sync (runs at 6 AM daily)
  await boss.createQueue('sync-exchange-rates');
  await boss.schedule('sync-exchange-rates', '0 6 * * *', {}, { tz: 'Asia/Jerusalem' });
  console.log('Scheduled daily exchange rate sync at 6 AM Israel time');

  // Create queue for categorization jobs (triggered on-demand after uploads)
  await boss.createQueue(CATEGORIZE_BUSINESSES_JOB_NAME);
  console.log('Categorization job queue created');

  // Register categorize-businesses job handler
  await boss.work(CATEGORIZE_BUSINESSES_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Running categorize-businesses job ${job.id}`);
      try {
        const result = await categorizateBusinessesJob(job as any);
        console.log(`[Worker] Categorization completed:`, result);
      } catch (error) {
        console.error(`[Worker] Categorization failed:`, error);
        throw error;
      }
    }
  });

  // Create queue and schedule weekly business merge detection (runs Sundays at 2 AM)
  await boss.createQueue(DETECT_BUSINESS_MERGES_JOB_NAME);
  await boss.schedule(DETECT_BUSINESS_MERGES_JOB_NAME, '0 2 * * 0', {}, { tz: 'Asia/Jerusalem' });
  console.log('Scheduled weekly business merge detection on Sundays at 2 AM Israel time');

  // Register business merge detection job handler
  await boss.work(DETECT_BUSINESS_MERGES_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Running business merge detection job ${job.id}`);
      try {
        const result = await detectBusinessMergesJob(job as any);
        console.log(`[Worker] Business merge detection completed:`, result);
      } catch (error) {
        console.error(`[Worker] Business merge detection failed:`, error);
        throw error;
      }
    }
  });

  // Create queue and schedule weekly subscription detection (runs Sundays at 3 AM)
  await boss.createQueue(DETECT_SUBSCRIPTIONS_JOB_NAME);
  await boss.schedule(DETECT_SUBSCRIPTIONS_JOB_NAME, '0 3 * * 0', {}, { tz: 'Asia/Jerusalem' });
  console.log('Scheduled weekly subscription detection on Sundays at 3 AM Israel time');

  // Register subscription detection job handler
  await boss.work(DETECT_SUBSCRIPTIONS_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      console.log(`[Worker] Running subscription detection job ${job.id}`);
      try {
        const result = await detectSubscriptionsJob(job as any);
        console.log(`[Worker] Subscription detection completed:`, result);
      } catch (error) {
        console.error(`[Worker] Subscription detection failed:`, error);
        throw error;
      }
    }
  });

  console.log('Worker is ready and listening for jobs.');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down worker...');
    await closePgBoss();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down worker...');
    await closePgBoss();
    process.exit(0);
  });
}

startWorker().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});