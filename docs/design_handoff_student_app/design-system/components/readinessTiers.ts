/**
 * Readiness tiers — single source of truth.
 *
 * INSTALL AT: lib/learning/readinessTiers.ts
 *
 * REPO RULE (from CLAUDE.md): never show a numeric score as the user-facing
 * label on knowledge-map / readiness results. Render the tier word. The %
 * still drives the ring fill visually — that's fine; the *label* must be the
 * tier.
 *
 * Five-tier scale chosen to give meaningful guidance:
 *   critical  <  20%   "We need to look at this together."
 *   weak      20–39%   "Foundations need work."
 *   fair      40–64%   "On the way — keep going."
 *   on track  65–84%   "Solid, push for fluency."
 *   strong    85%+     "You've got this."
 */

export type ReadinessTier = 'critical' | 'weak' | 'fair' | 'on track' | 'strong';

export function readinessTier(pct: number): ReadinessTier {
  if (pct < 20) return 'critical';
  if (pct < 40) return 'weak';
  if (pct < 65) return 'fair';
  if (pct < 85) return 'on track';
  return 'strong';
}

/** CSS-variable names (text + fill) for each tier. Use Ring's colorVar prop. */
export const READINESS_STYLE: Record<
  ReadinessTier,
  { textVar: string; fillVar: string; tailwindText: string; tailwindBg: string }
> = {
  critical:   { textVar: '--color-critical-text',  fillVar: '--color-critical-fill',  tailwindText: 'text-status-critical-text',  tailwindBg: 'bg-status-critical-fill/10' },
  weak:       { textVar: '--color-weak-text',      fillVar: '--color-weak-fill',      tailwindText: 'text-status-weak-text',      tailwindBg: 'bg-status-weak-fill/10' },
  fair:       { textVar: '--color-fair-text',      fillVar: '--color-fair-fill',      tailwindText: 'text-status-fair-text',      tailwindBg: 'bg-status-fair-fill/10' },
  'on track': { textVar: '--color-on-track-text',  fillVar: '--color-on-track-fill',  tailwindText: 'text-status-on-track-text',  tailwindBg: 'bg-status-on-track-fill/10' },
  strong:     { textVar: '--color-success-text',   fillVar: '--color-success-fill',   tailwindText: 'text-status-success-text',   tailwindBg: 'bg-status-success-fill/10' },
};

/** Tier label for user-facing copy. Title-cased. */
export function readinessLabel(tier: ReadinessTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
