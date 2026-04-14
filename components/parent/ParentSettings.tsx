'use client'

import { useEffect, useState } from 'react'

type Profile = {
  digestOptOut: boolean
  inactivityOptOut?: boolean
  digestDay: string
  digestTime: string
  digestTimezone: string | null
  /** NFR language: UI language preference */
  language?: 'en' | 'hi'
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function ParentSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [children, setChildren] = useState<Array<{ id: string; name: string; grade?: string | null; isPaused: boolean; pausedUntil?: string | null; pauseReason?: string | null; excludeFromParentReport?: boolean; inactivityOptOut?: boolean }>>([])
  const [message, setMessage] = useState<string | null>(null)
  const [pauseDialogStudentId, setPauseDialogStudentId] = useState<string | null>(null)
  const [pauseDialogReason, setPauseDialogReason] = useState<string>('')
  const [pauseDialogDate, setPauseDialogDate] = useState<string>('')
  const [mutedLinkStudentId, setMutedLinkStudentId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/parent/settings')
      .then((r) => r.json())
      .then((data) => {
        setProfile(data)
        setChildren(data.children ?? [])
      })
      .catch(() => setProfile({ digestOptOut: false, inactivityOptOut: false, digestDay: 'Sunday', digestTime: '09:00', digestTimezone: null, language: 'en' }))
      .finally(() => setLoading(false))
  }, [])

  // Detect tokenized mute redirect from alert links: ?muted=1&studentId=...
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('muted') === '1') {
        const sid = params.get('studentId')
        setMessage('Inactivity alerts muted')
        if (sid) setMutedLinkStudentId(sid)
      }
    } catch (e) {}
  }, [])

  function autoDetectTz() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setProfile((p) => (p ? { ...p, digestTimezone: tz } : p))
    } catch (e) {}
  }

  async function save() {
    if (!profile) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/parent/settings', { method: 'POST', body: JSON.stringify(profile), headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (res.ok && data.ok) {
        setMessage('Saved')
      } else {
        setMessage('Save failed')
      }
    } catch (e) {
      setMessage('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function togglePause(studentId: string, pause: boolean, pausedUntilParam?: string | null, pauseReasonParam?: string | null) {
    setSaving(true)
    setMessage(null)
    try {
      const pausedUntil = pausedUntilParam ?? null
      const pauseReason = pauseReasonParam ?? null

      const res = await fetch('/api/parent/pause', {
        method: 'POST',
        body: JSON.stringify({ studentId, action: pause ? 'pause' : 'unpause', pausedUntil, pauseReason }),
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setChildren((c) => c.map((ch) => (ch.id === studentId ? { ...ch, isPaused: pause, pausedUntil: data.link?.pausedUntil ?? pausedUntil ?? null, pauseReason: data.link?.pauseReason ?? pauseReason } : ch)))
        setMessage(pause ? 'Paused' : 'Unpaused')
      } else {
        setMessage('Action failed')
      }
    } catch (e) {
      setMessage('Action failed')
    } finally {
      setSaving(false)
      // reset any pause dialog state
      setPauseDialogStudentId(null)
      setPauseDialogReason('')
      setPauseDialogDate('')
    }
  }

  function openPauseDialog(studentId: string) {
    setPauseDialogStudentId(studentId)
    // default date = 7 days from today
    const defaultDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const isoDate = defaultDate.toISOString().slice(0, 10)
    setPauseDialogDate(isoDate)
    setPauseDialogReason('')
  }

  function cancelPauseDialog() {
    setPauseDialogStudentId(null)
    setPauseDialogReason('')
    setPauseDialogDate('')
  }

  async function confirmPauseDialog() {
    if (!pauseDialogStudentId) return
    const d = pauseDialogDate ? new Date(pauseDialogDate + 'T00:00:00') : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await togglePause(pauseDialogStudentId, true, d.toISOString(), pauseDialogReason || null)
  }

  async function toggleExclude(studentId: string, exclude: boolean) {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/parent/settings', {
        method: 'POST',
        body: JSON.stringify({ children: [{ id: studentId, excludeFromParentReport: exclude }] }),
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setChildren((c) => c.map((ch) => (ch.id === studentId ? { ...ch, excludeFromParentReport: exclude } : ch)))
        setMessage(exclude ? 'Excluded from reports' : 'Included in reports')
      } else {
        setMessage('Action failed')
      }
    } catch (e) {
      setMessage('Action failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleChildInactivity(studentId: string, optOut: boolean) {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/parent/settings', {
        method: 'POST',
        body: JSON.stringify({ children: [{ id: studentId, inactivityOptOut: optOut }] }),
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setChildren((c) => c.map((ch) => (ch.id === studentId ? { ...ch, inactivityOptOut: optOut } : ch)))
        setMessage(optOut ? 'Child muted for inactivity alerts' : 'Child will receive inactivity alerts')
      } else {
        setMessage('Action failed')
      }
    } catch (e) {
      setMessage('Action failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4">Loading...</div>

  if (!profile) return <div className="p-4">Unable to load settings</div>

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <h1 className="text-lg font-semibold">Weekly digest settings</h1>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={profile.digestOptOut} onChange={(e) => setProfile({ ...profile, digestOptOut: e.target.checked })} />
        <span className="text-sm">Opt out of weekly digest emails</span>
      </label>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={profile.inactivityOptOut ?? false} onChange={(e) => setProfile({ ...profile, inactivityOptOut: e.target.checked })} />
        <span className="text-sm">Opt out of inactivity alerts (global)</span>
      </label>

      <div>
        <label className="text-sm block mb-1">Delivery day</label>
        <select value={profile.digestDay} onChange={(e) => setProfile({ ...profile, digestDay: e.target.value })} className="w-full rounded border px-3 py-2">
          {DAYS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div>
        <h2 className="text-md font-semibold">Children</h2>
        {children.length === 0 ? (
          <p className="text-sm text-gray-500">No linked children.</p>
        ) : (
          <div className="space-y-2">
            {children.map((child) => (
              <div key={child.id}>
                <div className="flex items-center justify-between rounded border p-2">
                  <div>
                    <div className="font-medium">{child.name}</div>
                    {child.grade && <div className="text-xs text-gray-500">Grade {child.grade}</div>}
                    {mutedLinkStudentId === child.id && (
                      <div className="text-xs text-green-700">Muted via alert link</div>
                    )}
                    {child.isPaused && (
                      <div className="text-xs text-amber-700">Paused until {child.pausedUntil ?? 'indefinitely'}</div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => child.isPaused ? togglePause(child.id, false) : openPauseDialog(child.id)} disabled={saving} className="rounded border px-3 py-1 text-sm">
                        {child.isPaused ? 'Unpause' : 'Pause'}
                      </button>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={child.excludeFromParentReport ?? false} onChange={(e) => toggleExclude(child.id, e.target.checked)} />
                        <span className="text-xs">Exclude from parent reports</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm ml-2">
                        <input type="checkbox" checked={child.inactivityOptOut ?? false} onChange={(e) => toggleChildInactivity(child.id, e.target.checked)} />
                        <span className="text-xs">Mute inactivity alerts for this child</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* pause dialog removed temporarily to fix parse errors during build */}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm block mb-1">Delivery time</label>
        <input type="time" value={profile.digestTime} onChange={(e) => setProfile({ ...profile, digestTime: e.target.value })} className="w-full rounded border px-3 py-2" />
      </div>

      <div>
        <label className="text-sm block mb-1">Timezone (IANA)</label>
        <div className="flex gap-2">
          <input type="text" value={profile.digestTimezone ?? ''} onChange={(e) => setProfile({ ...profile, digestTimezone: e.target.value || null })} placeholder="Asia/Kolkata" className="flex-1 rounded border px-3 py-2" />
          <button type="button" onClick={autoDetectTz} className="rounded bg-gray-100 px-3 py-2 text-sm">Auto</button>
        </div>
        <p className="text-xs text-gray-500 mt-1">If blank, your account timezone will be used.</p>
      </div>

      <div>
        <label className="text-sm block mb-1">App language / भाषा</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setProfile({ ...profile, language: 'en' })}
            className={`min-h-[44px] min-w-[44px] flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors ${profile.language !== 'hi' ? 'bg-[#534AB7] text-white border-[#534AB7]' : 'bg-white text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200'}`}
            aria-pressed={profile.language !== 'hi'}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setProfile({ ...profile, language: 'hi' })}
            className={`min-h-[44px] min-w-[44px] flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors ${profile.language === 'hi' ? 'bg-[#534AB7] text-white border-[#534AB7]' : 'bg-white text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200'}`}
            aria-pressed={profile.language === 'hi'}
          >
            हिंदी
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="rounded bg-[#534AB7] px-4 py-2 text-white min-h-[44px] min-w-[44px]">
          {saving ? 'Saving...' : 'Save'}
        </button>
        {message && <span className="text-sm text-gray-600">{message}</span>}
      </div>
    </div>
  )
}
