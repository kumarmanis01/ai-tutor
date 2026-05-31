'use client'
import React, { useEffect, useRef, useState } from 'react'
import { TIERS, TierKey } from '@/lib/constants/tiers'

interface RingProps {
  tier: TierKey
  size?: number
  stroke?: number
  children?: React.ReactNode
  animate?: boolean
}

export function Ring({ tier, size = 56, stroke = 6, children, animate = true }: RingProps) {
  const t = TIERS[tier]
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = t.pct / 100
  const [off, setOff] = useState(animate ? circ : circ * (1 - pct))
  const ref = useRef<SVGCircleElement>(null)

  useEffect(() => {
    if (!animate) return
    const id = setTimeout(() => setOff(circ * (1 - pct)), 80)
    return () => clearTimeout(id)
  }, [animate, circ, pct])

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          ref={ref}
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={t.cssColor} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}
