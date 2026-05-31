import React from 'react'
import { Btn } from './Btn'

interface ErrorStateProps {
  title?: string
  body?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Something went wrong',
  body = "We couldn't load this right now. Check your connection and try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '44px 28px' }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: 'var(--tier-critical-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--tier-critical)', marginBottom: 18, fontSize: 28,
      }}>
        ⚠
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6, color: 'var(--text)' }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 270 }}>
        {body}
      </div>
      {onRetry && (
        <div style={{ marginTop: 22 }}>
          <Btn variant="secondary" onClick={onRetry}>Try again</Btn>
        </div>
      )}
    </div>
  )
}
