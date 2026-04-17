'use client'

import React, { useState, useEffect } from 'react'
import useCurrentUser from '@/hooks/useCurrentUser'

const OPTIONS: Array<{ value: 'auto'|'on'|'off'; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

export default function CrunchModeToggle() {
  const { data: profile, mutate } = useCurrentUser()
  const initial = (profile as any)?.preferences?.crunchMode ?? 'auto'
  const [value, setValue] = useState<'auto'|'on'|'off'>(initial)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (profile) setValue((profile as any)?.preferences?.crunchMode ?? 'auto')
  }, [profile])

  async function update(v: 'auto'|'on'|'off') {
    setLoading(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { crunchMode: v } }),
      })
      if (res.ok) {
        setValue(v)
        mutate()
      } else {
        console.error('Failed to update crunch mode')
      }
    } catch (err) {
      console.error('Failed to update crunch mode', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <label className="text-xs text-gray-700 dark:text-gray-300">Focus</label>
      <select
        aria-label="Crunch mode"
        className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800"
        value={value}
        disabled={loading}
        onChange={(e) => update(e.target.value as 'auto'|'on'|'off')}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
