import React from 'react'

interface MonoProps {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

export function Mono({ children, style, className }: MonoProps) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', ...style }} className={className}>
      {children}
    </span>
  )
}
