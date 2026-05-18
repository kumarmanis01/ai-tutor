/**
 * Server-only: DB operations for cosmetic unlocks.
 * Import this only from API routes, workers, or server components.
 * Static data and pure helpers live in cosmetics.ts (browser-safe).
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { eligibleCosmetics } from './cosmetics';

/**
 * Unlocks any cosmetics the student has earned by reaching the given streak.
 * Reads the current cosmeticUnlocks, adds missing keys, writes back.
 * Idempotent: safe to call multiple times for the same streak value.
 * Never throws -- returns [] on error.
 */
export async function unlockCosmeticsForStreak(
  studentId: string,
  currentStreak: number,
): Promise<string[]> {
  try {
    const eligible = eligibleCosmetics(currentStreak);
    if (eligible.length === 0) return [];

    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { cosmeticUnlocks: true },
    });
    if (!user) return [];

    const existingList: string[] = Array.isArray(user.cosmeticUnlocks) ? user.cosmeticUnlocks : [];
    const existing = new Set(existingList);
    const newKeys = eligible.map((c) => c.key).filter((k) => !existing.has(k));
    if (newKeys.length === 0) return [];

    await prisma.user.update({
      where: { id: studentId },
      data: { cosmeticUnlocks: [...existingList, ...newKeys] },
    });

    logger.info('cosmetics.unlocked', {
      event: 'cosmetics_unlocked',
      context: { studentId, newKeys, currentStreak },
    });

    return newKeys;
  } catch (err) {
    logger.error('cosmetics.unlockForStreak.error', {
      event: 'cosmetics_unlock_error',
      context: { studentId, error: String(err) },
    });
    return [];
  }
}
