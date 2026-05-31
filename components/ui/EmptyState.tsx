import React from 'react'
import { Btn } from './Btn'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  body?: string
  action?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, body, action, onAction }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '48px 28px' }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-faint)', marginBottom: 18,
      }}>
        {icon ?? <span style={{ fontSize: 28 }}>✦</span>}
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6, color: 'var(--text)' }}>
        {title}
      </div>
      {body && (
        <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 260 }}>
          {body}
        </div>
      )}
      {action && (
        <div style={{ marginTop: 22 }}>
          <Btn onClick={onAction}>{action}</Btn>
        </div>
      )}
    </div>
  )
}
