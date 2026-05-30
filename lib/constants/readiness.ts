export const READINESS_TIERS = [
  { max: 19,  label: 'critical' },
  { max: 39,  label: 'weak'    },
  { max: 64,  label: 'fair'    },
  { max: 84,  label: 'ontrack' },
  { max: 100, label: 'strong'  },
] as const;

export type ReadinessTier = typeof READINESS_TIERS[number]['label'];

export function getReadinessTier(score: number): ReadinessTier {
  return (READINESS_TIERS.find(t => score <= t.max) ?? READINESS_TIERS[READINESS_TIERS.length - 1]).label;
}
