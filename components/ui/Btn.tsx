'use client'
import React from 'react'

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
type BtnSize = 'sm' | 'md' | 'lg'

interface BtnProps {
  children?: React.ReactNode
  variant?: BtnVariant
  size?: BtnSize
  full?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

const SIZES: Record<BtnSize, { h: number; px: number; fs: number }> = {
  sm: { h: 38, px: 14, fs: 13.5 },
  md: { h: 48, px: 18, fs: 15 },
  lg: { h: 56, px: 22, fs: 16 },
}

const VARIANTS: Record<BtnVariant, React.CSSProperties> = {
  primary:   { background: 'var(--primary)', color: 'var(--on-brand)', boxShadow: 'var(--shadow-brand)' },
  secondary: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
  ghost:     { background: 'transparent', color: 'var(--text-muted)' },
  outline:   { background: 'transparent', color: 'var(--primary)', border: '1.5px solid var(--primary)' },
  danger:    { background: 'var(--tier-critical)', color: '#fff' },
}

export function Btn({ children, variant = 'primary', size = 'md', full, icon, iconRight, disabled, onClick, type = 'button', className }: BtnProps) {
  const s = SIZES[size]
  const base: React.CSSProperties = {
    height: s.h,
    padding: `0 ${s.px}px`,
    fontSize: s.fs,
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    borderRadius: 'var(--r-md)',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: full ? '100%' : 'auto',
    transition: 'transform .12s, filter .15s, background .15s',
    opacity: disabled ? 0.5 : 1,
    whiteSpace: 'nowrap',
    minHeight: 44,
    minWidth: 44,
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={e => { e.currentTarget.style.transform = '' }}
      onMouseLeave={e => { e.currentTarget.style.transform = '' }}
      className={className}
      style={{ ...base, ...VARIANTS[variant] }}
    >
      {icon}{children}{iconRight}
    </button>
  )
}
