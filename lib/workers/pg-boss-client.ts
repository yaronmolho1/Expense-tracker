import {PgBoss} from 'pg-boss';

let boss: PgBoss | null = null;

export async function getPgBoss(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      schema: 'pgboss',
    });

    await boss.start();
  }

  return boss;
}

export async function closePgBoss(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}

export async function enqueueJob(jobName: string, data: any) {
  const boss = await getBossInstance();
  // Create queue if it doesn't exist
  await boss.createQueue(jobName);
  await boss.send(jobName, data);
}

function getBossInstance(): Promise<PgBoss> {
  return getPgBoss();
}
