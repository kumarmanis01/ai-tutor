/**
 * FILE OBJECTIVE:
 * - UI control to adjust the user's base font size preference.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/UI/FontSizeToggle.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | copilot | replace console.* with logger; add unit test
 */

'use client'

import React, { useEffect, useState } from 'react'
import useCurrentUser from '@/hooks/useCurrentUser'
import { logger } from '@/lib/logger'

const MAP: Record<string, number> = { small: 14, medium: 16, large: 18 }

export default function FontSizeToggle() {
  const { data: profile, mutate } = useCurrentUser()
  const initial = (profile as any)?.preferences?.fontSize ?? (localStorage.getItem('fontSize') || 'medium')
  const [value, setValue] = useState<string>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const v = (profile as any)?.preferences?.fontSize || localStorage.getItem('fontSize') || 'medium'
    setValue(v)
    apply(v)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  function apply(v: string) {
    const px = MAP[v] ?? MAP.medium
    try {
      document.documentElement.style.setProperty('--font-size-base', `${px}px`)
      localStorage.setItem('fontSize', v)
    } catch {
      // ignore
    }
  }

  async function onChange(v: string) {
    setValue(v)
    apply(v)
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: { fontSize: v } }),
      })
      if (res.ok) {
        mutate()
      }
    } catch (err) {
      logger.error('Failed to save font size', { error: err })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium">Font</label>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          className={`px-2 py-1 rounded ${value === 'small' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          onClick={() => onChange('small')}
          disabled={saving}
        >
          A
        </button>
        <button
          type="button"
          className={`px-2 py-1 rounded ${value === 'medium' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          onClick={() => onChange('medium')}
          disabled={saving}
        >
          A
        </button>
        <button
          type="button"
          className={`px-2 py-1 rounded ${value === 'large' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          onClick={() => onChange('large')}
          disabled={saving}
        >
          A+
        </button>
      </div>
    </div>
  )
}
