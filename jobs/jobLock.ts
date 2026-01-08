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
 */
export async function acquireJobLock(jobName: string, ttlMs: number): Promise<AcquireResult> {
  const db = getDb();
  const now = new Date();
  const until = new Date(Date.now() + ttlMs);

  try {
    // Fast path: try to create a lock row. If it succeeds we have the lock.
    await db.jobLock.create({ data: { jobName, lockedUntil: until } });
    return { acquired: true };
  } catch {
    // Create failed (likely due to existing row). Try conditional update: only update when the existing lock is expired.
    try {
      const res = await db.jobLock.updateMany({ where: { jobName, lockedUntil: { lt: now } }, data: { lockedUntil: until } });
      if (res.count && res.count > 0) {
        // We updated the expired lock and acquired ownership.
        return { acquired: true };
      }

      // Lock exists and is not expired.
      const existing = await db.jobLock.findUnique({ where: { jobName } });
      if (existing && existing.lockedUntil > now) {
        return { skipped: true, reason: 'locked' };
      }

      // Edge case: try create again as a last resort.
      try {
        await db.jobLock.create({ data: { jobName, lockedUntil: until } });
        return { acquired: true };
      } catch {
        return { skipped: true, reason: 'locked' };
      }
    } catch {
      // On any unexpected error, avoid throwing to callers; signal skipped with reason.
      return { skipped: true, reason: 'error' };
    }
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
