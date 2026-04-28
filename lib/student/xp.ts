import { prisma } from '@/lib/prisma';
import { sendPushSafe } from '@/lib/push/send';
import { PUSH_NOTIFICATIONS } from '@/lib/push/notifications';
import {
  getLevelFromXP,
  getXPToNextLevel,
  getProgressPercent,
  getLevelTierName,
  getTierColor,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
} from '@/lib/student/xpLevels';

// Re-export pure level functions and constants for existing callers.
export {
  getLevelFromXP,
  getXPToNextLevel,
  getProgressPercent,
  getLevelTierName,
  getTierColor,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
};

export type StudentXPSource = 'session_correct' | 'streak_bonus' | 'revision_complete' | 'badge';

/**
 * Award XP to a student.
 * 1. Insert StudentXP row.
 * 2. Increment User.totalXp atomically.
 * 3. Recalculate level from new totalXp.
 * 4. If level changed -- update User.level, return leveledUp: true.
 * All in a Prisma transaction. Never throws -- returns null on error.
 */
export async function awardXP(params: {
  studentId: string;
  amount: number;
  source: StudentXPSource;
  sessionId?: string;
}): Promise<{
  xpAwarded: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  newLevel: number | null;
} | null> {
  const amount = Math.max(0, Math.floor(params.amount));
  if (amount === 0) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: params.studentId },
        select: { totalXp: true, level: true },
      });
      if (!user) return null;
      return {
        xpAwarded: 0,
        totalXp: user.totalXp,
        level: user.level,
        leveledUp: false,
        newLevel: null,
      };
    } catch {
      return null;
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: params.studentId },
        select: { totalXp: true, level: true },
      });
      if (!user) return null;

      await tx.studentXP.create({
        data: {
          studentId: params.studentId,
          source: params.source,
          amount,
          sessionId: params.sessionId ?? null,
        },
      });

      const newTotalXp = user.totalXp + amount;
      const newLevel = getLevelFromXP(newTotalXp);
      const levelChanged = newLevel !== user.level;

      await tx.user.update({
        where: { id: params.studentId },
        data: {
          totalXp: newTotalXp,
          ...(levelChanged ? { level: newLevel } : {}),
        },
      });

      return {
        xpAwarded: amount,
        totalXp: newTotalXp,
        level: newLevel,
        leveledUp: levelChanged,
        newLevel: levelChanged ? newLevel : null,
      };
    });
    // Fire level-up push notification (best-effort, outside transaction)
    if (result?.leveledUp && result.newLevel !== null) {
      void sendPushSafe(params.studentId, PUSH_NOTIFICATIONS.level_up(result.newLevel));
    }
    return result;
  } catch {
    return null;
  }
}
