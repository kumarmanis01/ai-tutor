import React from 'react'

interface CardProps {
  children: React.ReactNode
  pad?: number
  onClick?: () => void
  glow?: boolean
  accent?: string
  style?: React.CSSProperties
  className?: string
}

export function Card({ children, pad = 16, onClick, glow, accent, style, className }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg)',
        padding: pad,
        border: '1px solid var(--border)',
        boxShadow: glow ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        ...(accent ? { borderTop: `3px solid ${accent}` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
