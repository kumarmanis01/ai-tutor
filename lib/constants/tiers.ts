export const TIERS = {
  critical: { label: 'Critical', order: 0, cssColor: 'var(--tier-critical)', cssSoft: 'var(--tier-critical-soft)', pct: 22 },
  weak:     { label: 'Weak',     order: 1, cssColor: 'var(--tier-weak)',     cssSoft: 'var(--tier-weak-soft)',     pct: 40 },
  fair:     { label: 'Fair',     order: 2, cssColor: 'var(--tier-fair)',     cssSoft: 'var(--tier-fair-soft)',     pct: 58 },
  ontrack:  { label: 'On Track', order: 3, cssColor: 'var(--tier-ontrack)',  cssSoft: 'var(--tier-ontrack-soft)', pct: 76 },
  strong:   { label: 'Strong',   order: 4, cssColor: 'var(--tier-strong)',   cssSoft: 'var(--tier-strong-soft)',  pct: 92 },
} as const

export type TierKey = keyof typeof TIERS
// RULE: students NEVER see numeric readiness scores -- tier labels only
