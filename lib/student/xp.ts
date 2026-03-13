import { prisma } from '@/lib/prisma'

// Level thresholds — XP required to reach each level (cumulative).
// Level 1: 0, Level 2: 100, Level 3: 250, Level 4: 500,
// Level 5: 1000, Level 6: 2000, Level 7: 3500, Level 8: 5000,
// Level 9: 7500, Level 10: 10000
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000]

const MAX_LEVEL = LEVEL_THRESHOLDS.length

/**
 * Returns level 1–10 from total XP. Level 10 is max (capped).
 */
export function getLevelFromXP(totalXp: number): number {
  if (totalXp <= 0) return 1
  let level = 1
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
      break
    }
  }
  return Math.min(level, MAX_LEVEL)
}

/**
 * Returns XP needed to reach next level. null if already level 10.
 */
export function getXPToNextLevel(totalXp: number): number | null {
  const level = getLevelFromXP(totalXp)
  if (level >= MAX_LEVEL) return null
  const nextThreshold = LEVEL_THRESHOLDS[level]
  return nextThreshold - totalXp
}

/**
 * Returns 0–100 progress within the current level band.
 */
export function getProgressPercent(totalXp: number): number {
  const level = getLevelFromXP(totalXp)
  if (level >= MAX_LEVEL) return 100
  const currentThreshold = LEVEL_THRESHOLDS[level - 1]
  const nextThreshold = LEVEL_THRESHOLDS[level]
  const bandSize = nextThreshold - currentThreshold
  const xpInBand = totalXp - currentThreshold
  if (bandSize <= 0) return 100
  return Math.min(100, Math.round((xpInBand / bandSize) * 100))
}

export type StudentXPSource =
  | 'session_correct'
  | 'streak_bonus'
  | 'revision_complete'
  | 'badge'

/**
 * Award XP to a student.
 * 1. Insert StudentXP row.
 * 2. Increment User.totalXp atomically.
 * 3. Recalculate level from new totalXp.
 * 4. If level changed — update User.level, return leveledUp: true.
 * All in a Prisma transaction. Never throws — returns null on error.
 */
export async function awardXP(params: {
  studentId: string
  amount: number
  source: StudentXPSource
  sessionId?: string
}): Promise<{
  xpAwarded: number
  totalXp: number
  level: number
  leveledUp: boolean
  newLevel: number | null
} | null> {
  const amount = Math.max(0, Math.floor(params.amount))
  if (amount === 0) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: params.studentId },
        select: { totalXp: true, level: true },
      })
      if (!user) return null
      return {
        xpAwarded: 0,
        totalXp: user.totalXp,
        level: user.level,
        leveledUp: false,
        newLevel: null,
      }
    } catch {
      return null
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: params.studentId },
        select: { totalXp: true, level: true },
      })
      if (!user) return null

      await tx.studentXP.create({
        data: {
          studentId: params.studentId,
          source: params.source,
          amount,
          sessionId: params.sessionId ?? null,
        },
      })

      const newTotalXp = user.totalXp + amount
      const newLevel = getLevelFromXP(newTotalXp)
      const levelChanged = newLevel !== user.level

      await tx.user.update({
        where: { id: params.studentId },
        data: {
          totalXp: newTotalXp,
          ...(levelChanged ? { level: newLevel } : {}),
        },
      })

      return {
        xpAwarded: amount,
        totalXp: newTotalXp,
        level: newLevel,
        leveledUp: levelChanged,
        newLevel: levelChanged ? newLevel : null,
      }
    })
    return result
  } catch {
    return null
  }
}
