import { prisma } from '@/lib/prisma';

/**
 * Determines if a student should have AI tutor access based on:
 * 1. Global kill switch (ENABLE_AI_TUTOR env var)
 * 2. Per-user StudentFeatureFlag override
 * 3. Percentage-based rollout via stable hash
 */
export async function isInAITutorRollout(userId: string): Promise<boolean> {
  // Step 1: Global kill switch
  if (process.env.ENABLE_AI_TUTOR !== 'true') return false;

  // Step 2: Check StudentFeatureFlag for explicit override
  const flag = await prisma.studentFeatureFlag
    .findUnique({
      where: { studentId_key: { studentId: userId, key: 'AI_TUTOR' } },
      select: { enabled: true },
    })
    .catch(() => null);

  if (flag !== null) return flag.enabled;

  // Step 3: Stable hash-based rollout
  const pct = parseInt(process.env.ROLLOUT_PERCENTAGE ?? '5', 10);
  const hash = djb2Hash(userId) % 100;
  return hash < pct;
}

/** djb2 hash -- deterministic, no external deps */
export function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash = hash & hash; // convert to 32-bit integer
  }
  return Math.abs(hash);
}
