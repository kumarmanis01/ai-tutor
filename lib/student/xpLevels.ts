/**
 * XP level progression constants and pure computation functions.
 * Expanded to a 100-level progression to support finer-grained leveling.
 * No imports -- safe to use in both server code and client components.
 *
 * LEVEL_THRESHOLDS: minimum cumulative XP required to reach that level
 * (index 0 = level 1). The system exposes `MAX_LEVEL = 100` for UI and
 * progression logic.
 *
 * Tier names map to larger bands with visual frame changes at levels
 * 10, 20, 30, 50, 75, and 100 as requested in F-STU-031.
 */

// Base thresholds for levels 1..10 (preserve original small-level curve)
const BASE_THRESHOLDS = [0, 100, 300, 600, 1000, 1600, 2200, 3000, 4200, 6000];

// Generate thresholds for levels 1..100. We preserve the original first
// 10 thresholds for compatibility and then increase the gaps progressively
// so higher levels require more cumulative XP.
const generateThresholds = (): number[] => {
  const thresholds: number[] = [...BASE_THRESHOLDS];
  // Continue from level 11 (index 10) through level 100 (index 99)
  for (let lvl = 11; lvl <= 100; lvl++) {
    const prev = thresholds[thresholds.length - 1];
    // Gap grows linearly with level (100 * level) to keep growth predictable
    const gap = 100 * lvl;
    thresholds.push(prev + gap);
  }
  return thresholds;
};

export const LEVEL_THRESHOLDS: readonly number[] = generateThresholds();

export const MAX_LEVEL = LEVEL_THRESHOLDS.length; // 100

/**
 * Returns level 1..MAX_LEVEL from total XP. Capped at MAX_LEVEL.
 */
export function getLevelFromXP(totalXp: number): number {
  if (totalXp <= 0) return 1;
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return Math.min(level, MAX_LEVEL);
}

/**
 * Returns XP needed to reach the next level. null if already at MAX_LEVEL.
 */
export function getXPToNextLevel(totalXp: number): number | null {
  const level = getLevelFromXP(totalXp);
  if (level >= MAX_LEVEL) return null;
  const nextThreshold = LEVEL_THRESHOLDS[level];
  return (nextThreshold as number) - totalXp;
}

/**
 * Returns 0-100 progress within the current level band.
 */
export function getProgressPercent(totalXp: number): number {
  const level = getLevelFromXP(totalXp);
  if (level >= MAX_LEVEL) return 100;
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] as number;
  const nextThreshold = LEVEL_THRESHOLDS[level] as number;
  const bandSize = nextThreshold - currentThreshold;
  const xpInBand = totalXp - currentThreshold;
  if (bandSize <= 0) return 100;
  return Math.min(100, Math.round((xpInBand / bandSize) * 100));
}

/**
 * Returns the tier name for a given level. Tier breaks at levels:
 * 10, 20, 30, 50, 75, 100 -> mapping to frame changes.
 */
export function getLevelTierName(level: number): string {
  if (level >= 100) return 'Legend';
  if (level >= 75) return 'Diamond';
  if (level >= 50) return 'Platinum';
  if (level >= 30) return 'Gold';
  if (level >= 20) return 'Silver';
  if (level >= 10) return 'Bronze';
  if (level >= 3) return 'Explorer';
  return 'Learner';
}

/**
 * Returns the hex color for the avatar tier ring at each tier boundary.
 * Frame changes at levels 10/20/30/50/75/100 per F-STU-031 AC-03.
 */
export function getTierColor(level: number): string {
  if (level >= 100) return '#F97316'; // Legend -- orange/fire
  if (level >= 75) return '#8B5CF6'; // Diamond -- violet
  if (level >= 50) return '#0EA5E9'; // Platinum -- sky blue
  if (level >= 30) return '#D97706'; // Gold -- amber
  if (level >= 20) return '#94A3B8'; // Silver -- slate
  if (level >= 10) return '#B45309'; // Bronze -- warm brown
  if (level >= 3) return '#3B82F6'; // Explorer -- blue
  return '#9CA3AF'; // Learner -- gray
}
