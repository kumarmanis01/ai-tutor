import React from 'react'
import { TIERS, TierKey } from '@/lib/constants/tiers'

interface TierPillProps {
  tier: TierKey
  size?: 'sm' | 'md'
  showDot?: boolean
}

export function TierPill({ tier, size = 'md', showDot = true }: TierPillProps) {
  const t = TIERS[tier]
  const s = size === 'sm'
    ? { h: 22, fs: 11, px: 8, dot: 6 }
    : { h: 27, fs: 12.5, px: 10, dot: 7 }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: s.h,
      padding: `0 ${s.px}px`,
      borderRadius: 'var(--r-pill)',
      background: t.cssSoft,
      color: t.cssColor,
      fontSize: s.fs,
      fontWeight: 700,
      letterSpacing: '-0.01em',
      whiteSpace: 'nowrap',
    }}>
      {showDot && (
        <span style={{ width: s.dot, height: s.dot, borderRadius: 99, background: t.cssColor }} />
      )}
      {t.label}
    </span>
  )
}
