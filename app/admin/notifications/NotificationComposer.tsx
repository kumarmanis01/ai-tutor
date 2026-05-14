'use client'

import React, { useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AudienceKey =
  | 'all_students'
  | 'inactive_7d'
  | 'grade_10'
  | 'no_diagnostic'
  | 'paid_subscribers'

export interface AudienceCounts {
  all_students: number
  inactive_7d: number
  grade_10: number
  no_diagnostic: number
  paid_subscribers: number
}

type ChannelType = 'push' | 'email' | 'whatsapp'

const AUDIENCE_LABELS: Record<AudienceKey, string> = {
  all_students:    'All students',
  inactive_7d:     'Inactive 7+ days',
  grade_10:        'Grade 10 students',
  no_diagnostic:   'No diagnostic yet',
  paid_subscribers: 'Paid subscribers',
}

const CHANNEL_META: Record<ChannelType, { label: string; icon: string; note: string }> = {
  push:     { label: 'Push',     icon: '🔔', note: 'Requires app installed + notifications enabled' },
  email:    { label: 'Email',    icon: '✉️',  note: 'Delivered to registered email address' },
  whatsapp: { label: 'WhatsApp', icon: '💬', note: 'Delivered to WhatsApp number collected at onboarding' },
}

// Maps our named audiences to the existing broadcast API format
function audienceToApiPayload(audience: AudienceKey) {
  if (audience === 'inactive_7d') return { type: 'inactive', days: 7 }
  if (audience === 'grade_10')    return { type: 'grade', grade: 10 }
  return { type: 'all' }
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

export function NotificationComposer({ counts }: { counts: AudienceCounts }) {
  const [audience, setAudience] = useState<AudienceKey>('all_students')
  const [channel, setChannel] = useState<ChannelType>('email')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ queued: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [overrideBusy, setOverrideBusy] = useState(false)
  const [overrideResult, setOverrideResult] = useState<{ sentTo: number } | null>(null)

  const recipientCount = counts[audience]

  async function send() {
    if (!title.trim() || !message.trim()) return
    setBusy(true)
    setErr(null)
    setResult(null)
    try {
      const r = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience: audienceToApiPayload(audience),
          type: channel,
          title,
          body: message,
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok) {
        setResult({ queued: data.queued ?? recipientCount })
        setTitle('')
        setMessage('')
      } else {
        setErr(data.message ?? 'Failed to send')
      }
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Audience */}
      <div>
        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Audience
        </label>
        <select
          value={audience}
          onChange={e => setAudience(e.target.value as AudienceKey)}
          className="w-full text-[12px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
        >
          {(Object.keys(AUDIENCE_LABELS) as AudienceKey[]).map(k => (
            <option key={k} value={k}>
              {AUDIENCE_LABELS[k]} ({counts[k]} students)
            </option>
          ))}
        </select>
      </div>
      {/* Manual schedule override */}
      <div className="pt-2">
        <p className="text-[11px] text-gray-500 mb-2">Manual schedule actions</p>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setOverrideBusy(true)
              setOverrideResult(null)
              setErr(null)
              try {
                const r = await fetch('/api/admin/notifications/trigger-pending-diagnostics', { method: 'POST' })
                const data = await r.json().catch(() => ({}))
                if (r.ok) {
                  setOverrideResult({ sentTo: data.sentTo ?? 0 })
                } else {
                  setErr(data.message ?? 'Failed to trigger schedule')
                }
              } catch (e) {
                setErr('Network error')
              } finally {
                setOverrideBusy(false)
              }
            }}
            disabled={overrideBusy}
            className="px-3 py-2 rounded-xl bg-[#1D9E75] text-white text-[12px] hover:bg-[#16875f] disabled:opacity-50 min-h-[36px]"
          >
            {overrideBusy ? 'Running...' : 'Run pending diagnostics now'}
          </button>
          {overrideResult && (
            <p className="text-[12px] text-[#1D9E75] self-center">Sent to {overrideResult.sentTo} students</p>
          )}
        </div>
      </div>

      {/* Channel */}
      <div>
        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Channel
        </label>
        <div className="flex gap-2">
          {(Object.keys(CHANNEL_META) as ChannelType[]).map(c => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`flex-1 py-2 text-[11px] rounded-xl min-h-[36px] font-medium transition-colors ${
                channel === c
                  ? 'bg-[#534AB7] text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              <span className="mr-1">{CHANNEL_META[c].icon}</span>
              {CHANNEL_META[c].label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
          {CHANNEL_META[channel].note}
        </p>
        {channel === 'whatsapp' && (
          <div className="mt-2 rounded-lg bg-[#EAF3DE] dark:bg-[#1D9E75]/10 px-3 py-2">
            <p className="text-[10px] text-[#27500A] dark:text-green-400 font-medium">
              WhatsApp reaches only users who provided a number at onboarding.
              Admin broadcasts are sent as free-form text messages and typically deliver only within WhatsApp&apos;s
              24-hour customer-service window. Outside that window, a pre-approved template message is required.
            </p>
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Title {channel === 'whatsapp' && <span className="text-gray-400">(used as message heading on WhatsApp)</span>}
        </label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Notification title"
          maxLength={200}
          className="w-full text-[12px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
        />
      </div>

      {/* Message */}
      <div>
        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Message
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Message body"
          rows={3}
          maxLength={1000}
          className="w-full text-[12px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#534AB7] resize-none"
        />
      </div>

      {/* Preview */}
      {preview && title && message && (
        <div className="rounded-xl border border-[#534AB7]/30 bg-[#EEEDFE] p-4">
          <p className="text-[10px] font-semibold text-[#534AB7] mb-1 uppercase tracking-wide">
            Preview ({CHANNEL_META[channel].label})
          </p>
          {channel === 'email' ? (
            <>
              <p className="text-[12px] font-semibold text-gray-800">{title}</p>
              <p className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-wrap">{message}</p>
              <p className="text-[10px] text-gray-400 mt-2">Wrapped in Spinzy brand email template on delivery.</p>
            </>
          ) : channel === 'whatsapp' ? (
            <div className="bg-white rounded-lg p-3 text-[12px] font-sans">
              <p className="font-semibold text-gray-800">{title}</p>
              <p className="text-gray-600 mt-0.5 whitespace-pre-wrap">{message}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">-- Spinzy Academy</p>
            </div>
          ) : (
            <>
              <p className="text-[12px] font-semibold text-gray-800">{title}</p>
              <p className="text-[11px] text-gray-600 mt-0.5">{message}</p>
            </>
          )}
        </div>
      )}

      {/* Results / errors */}
      {result && (
        <p className="text-[12px] text-[#1D9E75]">
          Queued for {result.queued} recipient{result.queued === 1 ? '' : 's'}.
        </p>
      )}
      {err && <p className="text-[12px] text-[#E24B4A]">{err}</p>}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPreview(p => !p)}
          className="text-[11px] px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[36px] transition-colors"
        >
          {preview ? 'Hide preview' : 'Preview'}
        </button>
        <button
          onClick={send}
          disabled={!title.trim() || !message.trim() || busy || recipientCount === 0}
          className="flex-1 py-2 text-[12px] rounded-xl bg-[#534AB7] text-white hover:bg-[#3C3489] disabled:opacity-50 min-h-[36px] font-medium transition-colors"
        >
          {busy ? 'Sending...' : `Send to ${recipientCount} students`}
        </button>
      </div>
    </div>
  )
}
