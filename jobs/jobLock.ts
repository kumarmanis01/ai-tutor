import { prisma } from '@/lib/prisma';

type AcquireResult = { acquired: true } | { skipped: true; reason: string };

function getDb() {
  // Tests inject a test prisma instance as global.__TEST_PRISMA__
  // Prefer that for testability.
  return (global as any).__TEST_PRISMA__ || prisma;
}

/**
 * Try to acquire a named job lock for ttlMs milliseconds.
 * Returns { acquired: true } when the lock is obtained.
 * If another process holds a non-expired lock, returns { skipped: true, reason: 'locked' }.
 *
 * Single-round-trip UPSERT: insert or update only when the existing lock is expired.
 * Affected rows == 1 means we own the lock; 0 means another process holds a live lock.
 */
export async function acquireJobLock(jobName: string, ttlMs: number): Promise<AcquireResult> {
  const db = getDb();
  const now = new Date();
  const until = new Date(Date.now() + ttlMs);

  try {
    const affected = await db.$executeRaw`
      INSERT INTO "JobLock" ("jobName", "lockedUntil", "createdAt", "updatedAt")
      VALUES (${jobName}, ${until}, ${now}, ${now})
      ON CONFLICT ("jobName")
      DO UPDATE SET
        "lockedUntil" = ${until},
        "updatedAt"   = ${now}
      WHERE "JobLock"."lockedUntil" < ${now}
    `;
    return (affected as number) > 0
      ? { acquired: true }
      : { skipped: true, reason: 'locked' };
  } catch {
    return { skipped: true, reason: 'error' };
  }
}

/**
 * Release the named job lock. This is a best-effort operation and will not throw if the lock is missing.
 */
export async function releaseJobLock(jobName: string): Promise<void> {
  const db = getDb();
  try {
    await db.jobLock.deleteMany({ where: { jobName } });
  } catch {
    // swallow errors to ensure release is best-effort
  }
}

export const jobLock = { acquireJobLock, releaseJobLock };
export default jobLock;
