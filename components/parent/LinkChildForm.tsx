'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'
import { toast } from '@/lib/toast'
import { SpinnerLoader } from '@/components/UI/loaders'

const CLASS_NAME = 'LinkChildForm'

export default function LinkChildForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [relationship, setRelationship] = useState<'father' | 'mother' | 'guardian'>('guardian')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const queryMode = String(params.get('mode') ?? '').toLowerCase()
    const queryCode = String(params.get('inviteCode') ?? params.get('code') ?? '').trim().toUpperCase().slice(0, 8)
    if (queryMode === 'code' || queryCode) setMode('code')
    if (queryCode) setCode(queryCode)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload: Record<string, string> = { action: 'link', relationship }
      if (mode === 'email') {
        if (!email.trim()) { setLoading(false); return }
        payload.studentEmail = email.trim()
      } else {
        if (code.trim().length < 8) { setLoading(false); return }
        payload.inviteCode = code.trim().toUpperCase()
      }

      const res = await fetch('/api/parent/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast('Child linked successfully!')
        router.push('/parent/dashboard')
      } else {
        const data = await res.json().catch(() => ({}))
        toast((data as { error?: string }).error ?? "Couldn't link child. Please try again.")
      }
    } catch (err) {
      toast("Couldn't link child. Please try again.")
      logger.error('Link child failed', { className: CLASS_NAME, error: String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('email')}
          className={[
            'flex-1 min-h-[44px] rounded-lg py-2 text-sm font-medium transition-colors',
            mode === 'email'
              ? 'bg-[#EEEDFE] text-[#534AB7] dark:bg-indigo-900/30 dark:text-indigo-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
          ].join(' ')}
        >
          By Email
        </button>
        <button
          type="button"
          onClick={() => setMode('code')}
          className={[
            'flex-1 min-h-[44px] rounded-lg py-2 text-sm font-medium transition-colors',
            mode === 'code'
              ? 'bg-[#EEEDFE] text-[#534AB7] dark:bg-indigo-900/30 dark:text-indigo-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
          ].join(' ')}
        >
          By Invite Code
        </button>
      </div>

      {/* Input */}
      {mode === 'email' ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Email linking works only if your child has added your email under{' '}
            <span className="font-medium">Profile &rarr; Parent Email</span>.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@email.com"
            required
            className="w-full min-h-[44px] px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ask your child to generate an invite code from their Profile (Parent Access), then enter it here.
          </p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter 8-digit code"
            maxLength={8}
            required
            className="w-full min-h-[44px] px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent font-mono text-center tracking-widest"
          />
        </div>
      )}

      {/* Relationship */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
          Your relationship to this child
        </label>
        <select
          value={relationship}
          onChange={(e) => setRelationship(e.target.value as 'father' | 'mother' | 'guardian')}
          className="w-full min-h-[44px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
        >
          <option value="father">Father</option>
          <option value="mother">Mother</option>
          <option value="guardian">Guardian</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => router.push('/parent/dashboard')}
          className="flex-1 min-h-[44px] rounded-lg border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || (mode === 'email' ? !email.trim() : code.trim().length < 8)}
          className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#534AB7] py-2 text-sm font-semibold text-white hover:bg-[#3C3489] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading && <SpinnerLoader size="small" color="#ffffff" />}
          {loading ? 'Linking...' : 'Link child'}
        </button>
      </div>
    </form>
  )
}
