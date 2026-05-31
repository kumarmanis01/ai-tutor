import React from 'react'

interface SectionTitleProps {
  children: React.ReactNode
  action?: string
  onAction?: () => void
}

export function SectionTitle({ children, action, onAction }: SectionTitleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 10px' }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', whiteSpace: 'nowrap' }}>
        {children}
      </h3>
      {action && (
        <button
          onClick={onAction}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0, minHeight: 44 }}
        >
          {action}
        </button>
      )}
    </div>
  )
}
