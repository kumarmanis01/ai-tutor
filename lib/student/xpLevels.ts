/**
 * XP level progression constants and pure computation functions.
 * No imports -- safe to use in both server code and client components.
 *
 * 100 levels with increasing XP gaps across five tiers:
 *   L1-10:  existing thresholds (unchanged, backward compatible)
 *   L11-20: +300 XP per level
 *   L21-30: +400 XP per level
 *   L31-50: +500 XP per level
 *   L51-75: +600 XP per level
 *   L76-100: +700 XP per level
 *
 * Level 100 reached at 59,500 XP (~2 years at 5 sessions/week @ 100 XP/session).
 *
 * Level tier names change at key milestones (AC-03, F-STU-031):
 *   1-9    Learner
 *   10-19  Explorer
 *   20-29  Practitioner
 *   30-49  Scholar
 *   50-74  Expert
 *   75-99  Master
 *   100    Legend
 */

// Threshold = minimum cumulative XP to reach that level (index 0 = level 1).
export const LEVEL_THRESHOLDS: readonly number[] = [
  // L1-10 (original thresholds, unchanged)
  0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000,
  // L11-20 (+300 each)
  10300, 10600, 10900, 11200, 11500, 11800, 12100, 12400, 12700, 13000,
  // L21-30 (+400 each)
  13400, 13800, 14200, 14600, 15000, 15400, 15800, 16200, 16600, 17000,
  // L31-40 (+500 each)
  17500, 18000, 18500, 19000, 19500, 20000, 20500, 21000, 21500, 22000,
  // L41-50 (+500 each)
  22500, 23000, 23500, 24000, 24500, 25000, 25500, 26000, 26500, 27000,
  // L51-60 (+600 each)
  27600, 28200, 28800, 29400, 30000, 30600, 31200, 31800, 32400, 33000,
  // L61-70 (+600 each)
  33600, 34200, 34800, 35400, 36000, 36600, 37200, 37800, 38400, 39000,
  // L71-75 (+600 each)
  39600, 40200, 40800, 41400, 42000,
  // L76-85 (+700 each)
  42700, 43400, 44100, 44800, 45500, 46200, 46900, 47600, 48300, 49000,
  // L86-95 (+700 each)
  49700, 50400, 51100, 51800, 52500, 53200, 53900, 54600, 55300, 56000,
  // L96-100 (+700 each)
  56700, 57400, 58100, 58800, 59500,
]

export const MAX_LEVEL = LEVEL_THRESHOLDS.length // 100

/**
 * Returns level 1-100 from total XP. Level 100 is max (capped).
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
 * Returns XP needed to reach the next level. null if already level 100.
 */
export function getXPToNextLevel(totalXp: number): number | null {
  const level = getLevelFromXP(totalXp)
  if (level >= MAX_LEVEL) return null
  const nextThreshold = LEVEL_THRESHOLDS[level]
  return (nextThreshold as number) - totalXp
}

/**
 * Returns 0-100 progress within the current level band.
 */
export function getProgressPercent(totalXp: number): number {
  const level = getLevelFromXP(totalXp)
  if (level >= MAX_LEVEL) return 100
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] as number
  const nextThreshold = LEVEL_THRESHOLDS[level] as number
  const bandSize = nextThreshold - currentThreshold
  const xpInBand = totalXp - currentThreshold
  if (bandSize <= 0) return 100
  return Math.min(100, Math.round((xpInBand / bandSize) * 100))
}

/**
 * Returns the tier name for a given level.
 * Tier names change at milestones 10, 20, 30, 50, 75, 100 (AC-03 F-STU-031).
 */
export function getLevelTierName(level: number): string {
  if (level >= 100) return 'Legend'
  if (level >= 75) return 'Master'
  if (level >= 50) return 'Expert'
  if (level >= 30) return 'Scholar'
  if (level >= 20) return 'Practitioner'
  if (level >= 10) return 'Explorer'
  return 'Learner'
}
