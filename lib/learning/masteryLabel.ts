/**
 * Mastery Label Utility
 *
 * Maps a mastery float (0–1) to a plain-language qualitative label
 * shown to students. The platform NEVER shows raw percentages or mastery
 * numbers to students — only these four labels.
 *
 * Thresholds:
 *   < 0.50  → "Needs practice"
 *   < 0.75  → "Getting there"
 *   < 0.90  → "Understood"
 *   ≥ 0.90  → "Mastered"
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created per UX architecture blueprint
 */

export type MasteryLabel = 'Needs practice' | 'Getting there' | 'Understood' | 'Mastered';

export type TopicStatus = 'needs_practice' | 'getting_there' | 'understood' | 'mastered' | 'in_progress' | 'upcoming';

/**
 * Returns a qualitative mastery label for display to students.
 * Input: mastery float in [0, 1]. Returns 'Needs practice' for null/undefined.
 */
export function getMasteryLabel(mastery: number | null | undefined): MasteryLabel {
  if (mastery == null || mastery < 0.5) return 'Needs practice';
  if (mastery < 0.75) return 'Getting there';
  if (mastery < 0.9) return 'Understood';
  return 'Mastered';
}

/**
 * Returns a topic status key used for icon and colour selection.
 * in_progress = actively in a session; upcoming = not yet started.
 */
export function getTopicStatus(
  mastery: number | null | undefined,
  isInProgress = false,
): TopicStatus {
  if (isInProgress) return 'in_progress';
  if (mastery == null || mastery === 0) return 'upcoming';
  if (mastery < 0.5) return 'needs_practice';
  if (mastery < 0.75) return 'getting_there';
  if (mastery < 0.9) return 'understood';
  return 'mastered';
}
