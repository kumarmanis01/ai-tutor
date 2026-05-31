'use client'
import React from 'react'

type NavTab = 'home' | 'path' | 'tutor' | 'tests' | 'progress'

interface BottomNavProps {
  active: NavTab
  onChange: (tab: NavTab) => void
}

const TABS: Array<{ id: NavTab; label: string; center?: boolean }> = [
  { id: 'home',     label: 'Home' },
  { id: 'path',     label: 'Path' },
  { id: 'tutor',    label: 'Vidya', center: true },
  { id: 'tests',    label: 'Tests' },
  { id: 'progress', label: 'Progress' },
]

function TabIcon({ id, size = 23, stroke = 1.9 }: { id: NavTab; size?: number; stroke?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (id === 'home') return <svg {...props}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>
  if (id === 'path') return <svg {...props}><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.4 6H14a3 3 0 0 1 3 3v0a3 3 0 0 0-3 3H10a3 3 0 0 0-3 3v0"/></svg>
  if (id === 'tutor') return <svg {...props}><path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3.5V16H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/><circle cx="9" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="13" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="10.5" r="1" fill="currentColor" stroke="none"/></svg>
  if (id === 'tests') return <svg {...props}><path d="M7 3h7l5 5v13H7V3Z"/><path d="M13 3v5h5"/><path d="M9 13l1.5 1.5L13 12"/><path d="M16 17H9"/></svg>
  return <svg {...props}><path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16l4-5 3 3 5-7"/></svg>
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      paddingBottom: 24, paddingTop: 8,
      background: 'color-mix(in oklch, var(--surface) 88%, transparent)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      borderTop: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
    }}>
      {TABS.map(t => {
        const on = active === t.id
        if (t.center) {
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 0, marginTop: -22, minWidth: 44, minHeight: 44 }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 18, background: 'var(--primary)', color: 'var(--on-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-brand)' }}>
                <TabIcon id={t.id} size={26} />
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: on ? 'var(--primary)' : 'var(--text-faint)' }}>{t.label}</span>
            </button>
          )
        }
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '2px 4px', flex: 1, minHeight: 44 }}
          >
            <div style={{ color: on ? 'var(--primary)' : 'var(--text-faint)', transition: 'color .2s' }}>
              <TabIcon id={t.id} size={23} stroke={on ? 2.2 : 1.9} />
            </div>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? 'var(--primary)' : 'var(--text-faint)' }}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
