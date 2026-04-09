'use client'

import { useEffect, useState } from 'react'

type Profile = {
  digestOptOut: boolean
  digestDay: string
  digestTime: string
  digestTimezone: string | null
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function ParentSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/parent/settings')
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .catch(() => setProfile({ digestOptOut: false, digestDay: 'Sunday', digestTime: '09:00', digestTimezone: null }))
      .finally(() => setLoading(false))
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

  if (loading) return <div className="p-4">Loading…</div>

  if (!profile) return <div className="p-4">Unable to load settings</div>

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <h1 className="text-lg font-semibold">Weekly digest settings</h1>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={profile.digestOptOut} onChange={(e) => setProfile({ ...profile, digestOptOut: e.target.checked })} />
        <span className="text-sm">Opt out of weekly digest emails</span>
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

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="rounded bg-[#534AB7] px-4 py-2 text-white">
          {saving ? 'Saving…' : 'Save'}
        </button>
        {message && <span className="text-sm text-gray-600">{message}</span>}
      </div>
    </div>
  )
}
