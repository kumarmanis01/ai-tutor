import React from 'react'
import { Card } from './Card'

interface SkelProps {
  w?: number | string
  h?: number
  r?: number
  style?: React.CSSProperties
  className?: string
}

export function Skel({ w = '100%', h = 14, r = 8, style, className }: SkelProps) {
  return (
    <div
      className={className}
      style={{
        width: w, height: h, borderRadius: r,
        background: 'linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-shine) 50%, var(--skeleton-base) 75%)',
        backgroundSize: '200% 100%',
        animation: 'spz-shimmer 1.4s infinite linear',
        ...style,
      }}
    />
  )
}

export function SkeletonCard() {
  return (
    <Card pad={16} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Skel w={64} h={22} r={99} />
        <Skel w={80} h={22} r={99} />
      </div>
      <Skel w="85%" h={16} />
      <Skel w="60%" h={16} />
    </Card>
  )
}
