import React from 'react'

interface AppHeaderProps {
  title: string
  sub?: string
  back?: boolean
  onBack?: () => void
  right?: React.ReactNode
  large?: boolean
}

function ChevLeft() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 5l-7 7 7 7"/>
    </svg>
  )
}

export function AppHeader({ title, sub, back, onBack, right, large }: AppHeaderProps) {
  return (
    <div style={{ padding: large ? '8px 20px 4px' : '6px 16px', display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
      {back && (
        <button
          onClick={onBack}
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)', flexShrink: 0, minWidth: 44, minHeight: 44 }}
        >
          <ChevLeft />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: large ? 22 : 17, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text)' }}>
          {title}
        </div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )
}
