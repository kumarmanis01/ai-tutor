import React from 'react'

type Accent = 'amber' | 'primary' | 'mint'

type Props = {
  badgeId: string
  accent?: Accent
  size?: number
  showcased?: boolean
}

const GLYPHS: Record<string, (props: { size: number }) => JSX.Element> = {
  lightning: ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M13 2L3 14h7l-1 8L21 10h-7l-0-8z" />
    </svg>
  ),
  star: ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  ),
  flame: ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M12 2s4 4 4 8a4 4 0 11-8 0c0-4 4-8 4-8z" />
      <path d="M8 14s1.5-1 4-1 4 1 4 1" />
    </svg>
  ),
  trophy: ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M8 2h8v4a4 4 0 01-8 0V2z" />
      <path d="M3 8h18v2a6 6 0 01-6 6H9a6 6 0 01-6-6V8z" />
      <path d="M9 20h6v2H9z" />
    </svg>
  ),
  target: ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  ),
  sparkle: ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M12 2v4M12 18v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M6.5 17.5l2.5-2.5M15 9l2.5-2.5" />
    </svg>
  ),
  brain: ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M12 3c-3 0-5 2-5 5v8c0 3 2 5 5 5s5-2 5-5V8c0-3-2-5-5-5z" />
      <path d="M7 8h10M7 16h10" />
    </svg>
  ),
  shield: ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M12 2l7 4v6c0 5-4 9-7 10-3-1-7-5-7-10V6l7-4z" />
    </svg>
  ),
  book: ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M20 6H7.5A2.5 2.5 0 005 8.5V18" />
      <path d="M7 6v12" />
    </svg>
  ),
  'check-circle': ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  'graduation-cap': ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M22 12l-10 5L2 12l10-5 10 5z" />
      <path d="M12 17v4" />
    </svg>
  ),
  medal: ({ size }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <circle cx="12" cy="8" r="4" />
      <path d="M8 14l-2 6 6-3 6 3-2-6" />
    </svg>
  ),
}

export const BADGE_GLYPH: Record<string, keyof typeof GLYPHS> = {
  streak_7: 'flame',
  streak_14: 'flame',
  streak_30: 'trophy',
  streak_60: 'trophy',
  streak_100: 'star',
  consistency: 'lightning',
  comeback: 'sparkle',
  chapter_master: 'star',
  mock_complete: 'medal',
  speedster: 'lightning',
}

export const BADGE_ACCENT: Record<string, Accent> = {
  streak_7: 'amber',
  streak_14: 'amber',
  streak_30: 'amber',
  streak_60: 'amber',
  streak_100: 'amber',
  consistency: 'amber',
  speedster: 'primary',
  chapter_master: 'primary',
  mock_complete: 'mint',
  comeback: 'mint',
}

export default function BadgeIcon({ badgeId, accent, size = 22, showcased = false }: Props) {
  const key = String(badgeId || '').toLowerCase()
  const glyphKey = BADGE_GLYPH[key] ?? 'medal'
  const Glyph = GLYPHS[glyphKey] ?? GLYPHS['medal']
  const acc: Accent = (accent ?? BADGE_ACCENT[key] ?? 'primary') as Accent

  const containerClasses = [
    'w-10 h-10 rounded-lg inline-flex items-center justify-center',
    `bg-${acc}-bg`,
    `text-${acc}-text`,
    showcased ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : '',
  ].filter(Boolean).join(' ')

  return (
    <span className={containerClasses} aria-hidden>
      {Glyph({ size })}
    </span>
  )
}
