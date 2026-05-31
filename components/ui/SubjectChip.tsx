import React from 'react'
import { SUBJECTS, SubjectKey } from '@/lib/constants/subjects'

interface SubjectChipProps {
  subject: SubjectKey
  size?: 'sm' | 'md'
  filled?: boolean
}

export function SubjectChip({ subject, size = 'md', filled }: SubjectChipProps) {
  const s = SUBJECTS[subject]
  const dims = size === 'sm' ? { h: 22, fs: 11, px: 8 } : { h: 26, fs: 12.5, px: 10 }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: dims.h,
      padding: `0 ${dims.px}px`,
      borderRadius: 'var(--r-pill)',
      fontSize: dims.fs,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      background: filled ? s.cssColor : `color-mix(in oklch, ${s.cssColor} 14%, transparent)`,
      color: filled ? '#fff' : s.cssColor,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: filled ? '#fff' : s.cssColor, opacity: filled ? 0.9 : 1 }} />
      {s.short}
    </span>
  )
}
