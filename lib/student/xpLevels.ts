/**
 * XP level progression constants and pure computation functions.
 * Simplified 10-level progression for F-STU-031.
 * No imports -- safe to use in both server code and client components.
 *
 * LEVEL_THRESHOLDS: minimum cumulative XP required to reach that level
 * (index 0 = level 1). The system exposes `MAX_LEVEL = 10` for UI and
 * progression logic.
 *
 * Tier names map to small-level bands suitable for a 10-level system.
 */

// Threshold = minimum cumulative XP to reach that level (index 0 = level 1).
export const LEVEL_THRESHOLDS: readonly number[] = [
  0,    // L1
  100,  // L2
  300,  // L3
  600,  // L4
  1000, // L5
  1600, // L6
  2200, // L7
  3000, // L8
  4200, // L9
  6000, // L10
]

export const MAX_LEVEL = LEVEL_THRESHOLDS.length // 10

/**
 * Returns level 1..MAX_LEVEL from total XP. Capped at MAX_LEVEL.
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
 * Returns XP needed to reach the next level. null if already at MAX_LEVEL.
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
 * Returns the tier name for a given level in the 10-level model.
 */
export function getLevelTierName(level: number): string {
  if (level >= MAX_LEVEL) return 'Legend'
  if (level >= 9) return 'Expert'
  if (level >= 7) return 'Scholar'
  if (level >= 5) return 'Practitioner'
  if (level >= 3) return 'Explorer'
  return 'Learner'
}
