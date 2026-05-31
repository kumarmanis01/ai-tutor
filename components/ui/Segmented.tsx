'use client'
import React from 'react'

interface SegmentedOption {
  id: string
  label: string
}

interface SegmentedProps {
  options: Array<SegmentedOption | string>
  value: string
  onChange: (val: string) => void
  full?: boolean
}

export function Segmented({ options, value, onChange, full }: SegmentedProps) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)', width: full ? '100%' : 'auto' }}>
      {options.map(o => {
        const id = typeof o === 'string' ? o : o.id
        const label = typeof o === 'string' ? o : o.label
        const on = value === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              flex: full ? 1 : undefined,
              height: 34, padding: '0 14px', border: 'none', cursor: 'pointer',
              borderRadius: 9, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
              background: on ? 'var(--surface)' : 'transparent',
              color: on ? 'var(--text)' : 'var(--text-muted)',
              boxShadow: on ? 'var(--shadow-sm)' : 'none',
              transition: 'all .15s', whiteSpace: 'nowrap',
              minHeight: 44,
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
