/**
 * AC-06 (F-STU-030): cosmetic reward items unlocked at streak milestones.
 *
 * Two item types:
 *   avatar_frame  -- decorative border rendered around the student avatar.
 *   profile_theme -- accent colour applied to the student profile card background.
 *
 * Cosmetics have no academic impact (spec requirement).
 *
 * This file is browser-safe: no Prisma or server-only imports.
 * DB operations live in cosmetics-service.ts (server-only).
 */

export type CosmeticType = 'avatar_frame' | 'profile_theme';

export interface CosmeticItem {
  key: string;
  name: string;
  type: CosmeticType;
  /** Streak milestone that unlocks this item. */
  streakMilestone: number;
  /** Accent colour (hex) used to render the frame or theme in the UI. */
  colour: string;
  description: string;
}

export const COSMETIC_ITEMS: readonly CosmeticItem[] = [
  {
    key: 'frame_flame',
    name: 'Flame Frame',
    type: 'avatar_frame',
    streakMilestone: 7,
    colour: '#F97316',
    description: 'Awarded for a 7-day learning streak',
  },
  {
    key: 'theme_indigo',
    name: 'Indigo Scholar',
    type: 'profile_theme',
    streakMilestone: 14,
    colour: '#534AB7',
    description: 'Awarded for a 14-day learning streak',
  },
  {
    key: 'frame_trophy',
    name: 'Trophy Frame',
    type: 'avatar_frame',
    streakMilestone: 30,
    colour: '#1D9E75',
    description: 'Awarded for a 30-day learning streak',
  },
  {
    key: 'theme_diamond',
    name: 'Diamond Scholar',
    type: 'profile_theme',
    streakMilestone: 60,
    colour: '#0EA5E9',
    description: 'Awarded for a 60-day learning streak',
  },
  {
    key: 'frame_crown',
    name: 'Crown Frame',
    type: 'avatar_frame',
    streakMilestone: 100,
    colour: '#EAB308',
    description: 'Awarded for a 100-day learning streak',
  },
];

/**
 * Returns all cosmetic items whose streakMilestone <= currentStreak.
 * Pure helper -- exported for tests.
 */
export function eligibleCosmetics(currentStreak: number): CosmeticItem[] {
  return COSMETIC_ITEMS.filter((c) => c.streakMilestone <= currentStreak);
}
