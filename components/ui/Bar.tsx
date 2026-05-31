import React from 'react'

interface BarProps {
  value: number
  max?: number
  color?: string
  h?: number
  track?: string
}

export function Bar({ value, max = 100, color = 'var(--primary)', h = 8, track = 'var(--surface-3)' }: BarProps) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ height: h, borderRadius: 99, background: track, overflow: 'hidden', width: '100%' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: color,
        borderRadius: 99,
        transition: 'width .8s cubic-bezier(0.22,1,0.36,1)',
      }} />
    </div>
  )
}
