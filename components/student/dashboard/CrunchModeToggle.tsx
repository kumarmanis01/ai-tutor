/**
 * FILE OBJECTIVE:
 * - Toggle to control user's 'crunch' / focus mode preference.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/CrunchModeToggle.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | replace console.* with logger; add unit test
 */

'use client'

import React, { useState, useEffect } from 'react'
import useCurrentUser from '@/hooks/useCurrentUser'
import { logger } from '@/lib/logger'
import { SpinnerLoader } from '@/components/UI/loaders'

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
        credentials: 'include',
        body: JSON.stringify({ preferences: { crunchMode: v } }),
      })
      if (res.ok) {
        setValue(v)
        mutate()
      } else {
        logger.error('Failed to update crunch mode', { status: res.status })
      }
    } catch (err) {
      logger.error('Failed to update crunch mode', { error: err })
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
      {loading && <SpinnerLoader size="small" />}
    </div>
  )
}
