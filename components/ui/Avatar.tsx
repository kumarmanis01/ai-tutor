import React from 'react'

interface AvatarProps {
  letter: string
  hue?: number
  size?: number
  ring?: boolean
}

export function Avatar({ letter, hue = 184, size = 40, ring }: AvatarProps) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 99, flexShrink: 0,
      background: `oklch(0.62 0.10 ${hue})`,
      color: '#fff', fontWeight: 700, fontSize: size * 0.42,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: ring
        ? `0 0 0 3px var(--surface), 0 0 0 5px oklch(0.62 0.10 ${hue} / 0.4)`
        : 'none',
    }}>
      {letter}
    </div>
  )
}
