'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'
import { toast } from '@/lib/toast'
import { SpinnerLoader } from '@/components/UI/loaders'

const CLASS_NAME = 'LinkChildForm'

// Scopes that the create-child API requires
const REQUIRED_CONSENT_SCOPES = [
  'DATA_PROCESSING',
  'AI_INTERACTION',
  'PARENT_NOTIFICATION',
  'COMMUNITY_FEATURES',
] as const

const GRADES = ['1','2','3','4','5','6','7','8','9','10','11','12'] as const
const BOARDS = ['CBSE', 'ICSE', 'State Board'] as const
const MEDIUMS = ['English', 'Hindi'] as const

type Tab = 'link' | 'create'
type LinkMode = 'email' | 'code'

// ── Tab A -- link existing student ──────────────────────────────────────

function LinkExistingForm({
  onSwitchToCreate,
}: {
  onSwitchToCreate: () => void
}) {
  const router = useRouter()
  const [mode, setMode] = useState<LinkMode>('code')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [relationship, setRelationship] = useState<'father' | 'mother' | 'guardian'>('guardian')
  const [loading, setLoading] = useState(false)
  const [fieldError, setFieldError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const queryMode = String(params.get('mode') ?? '').toLowerCase()
    const queryCode = String(params.get('inviteCode') ?? params.get('code') ?? '').trim().toUpperCase().slice(0, 8)
    if (queryMode === 'email') setMode('email')
    else if (queryCode) setMode('code')
    if (queryCode) setCode(queryCode)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError('')
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
        return
      }

      const data = await res.json().catch(() => ({})) as { error?: string }
      const msg = data.error ?? "Couldn't link child. Please try again."

      if (res.status === 404 && (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired'))) {
        setFieldError(
          "No account found with that " +
          (mode === 'email' ? "email address" : "invite code") +
          `. Ask your child to share their code from Profile → Parent Access, or use the "New profile" tab to create one.`
        )
      } else {
        setFieldError(msg)
      }
    } catch (err) {
      setFieldError("Couldn't link child. Please check your connection and try again.")
      logger.error('Link child failed', { className: CLASS_NAME, error: String(err) })
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = mode === 'email' ? email.trim().length > 0 : code.trim().length === 8

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setMode('code'); setFieldError('') }}
          className={[
            'flex-1 min-h-[44px] rounded-lg py-2 text-sm font-medium transition-colors',
            mode === 'code'
              ? 'bg-[#EEEDFE] text-[#534AB7] dark:bg-indigo-900/30 dark:text-indigo-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
          ].join(' ')}
        >
          By invite code
        </button>
        <button
          type="button"
          onClick={() => { setMode('email'); setFieldError('') }}
          className={[
            'flex-1 min-h-[44px] rounded-lg py-2 text-sm font-medium transition-colors',
            mode === 'email'
              ? 'bg-[#EEEDFE] text-[#534AB7] dark:bg-indigo-900/30 dark:text-indigo-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
          ].join(' ')}
        >
          By email
        </button>
      </div>

      {mode === 'code' ? (
        <div className="space-y-1.5">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ask your child to open Spinzy and go to <span className="font-medium">Profile &rarr; Parent Access</span> to generate their code.
          </p>
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setFieldError('') }}
            placeholder="Enter 8-digit code"
            maxLength={8}
            className="w-full min-h-[44px] px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent font-mono text-center tracking-widest"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Only works if your child has set your email under <span className="font-medium">Profile &rarr; Parent Email</span>.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldError('') }}
            placeholder="student@email.com"
            className="w-full min-h-[44px] px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent"
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
          <option value="guardian">Guardian</option>
          <option value="father">Father</option>
          <option value="mother">Mother</option>
        </select>
      </div>

      {/* Error / not-found message */}
      {fieldError && (
        <div className="rounded-lg bg-[#FCEBEB] dark:bg-red-900/20 px-4 py-3 text-sm text-[#E24B4A] dark:text-red-400">
          <p>{fieldError}</p>
          {fieldError.includes('New profile') && (
            <button
              type="button"
              onClick={onSwitchToCreate}
              className="mt-2 font-semibold underline underline-offset-2 hover:no-underline"
            >
              Create a new profile &rarr;
            </button>
          )}
        </div>
      )}

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
          disabled={loading || !canSubmit}
          className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#534AB7] py-2 text-sm font-semibold text-white hover:bg-[#3C3489] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading && <SpinnerLoader size="small" color="#ffffff" />}
          {loading ? 'Linking...' : 'Link child'}
        </button>
      </div>
    </form>
  )
}

// ── Tab B -- create new child profile ───────────────────────────────────

function CreateProfileForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [grade, setGrade] = useState('')
  const [board, setBoard] = useState('')
  const [medium, setMedium] = useState('')
  const [email, setEmail] = useState('')
  const [relationship, setRelationship] = useState<'father' | 'mother' | 'guardian'>('guardian')
  const [consentGiven, setConsentGiven] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!name.trim()) errors.name = 'Child name is required'
    if (!dateOfBirth) errors.dateOfBirth = 'Date of birth is required'
    if (!grade) errors.grade = 'Grade is required'
    if (!board) errors.board = 'Board is required'
    if (!medium) errors.medium = 'Medium is required'
    if (!consentGiven) errors.consent = 'You must confirm your authority to create this account'
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        dateOfBirth,
        grade,
        board,
        medium,
        relationship,
        consentScopes: [...REQUIRED_CONSENT_SCOPES],
      }
      if (email.trim()) payload.email = email.trim()

      const res = await fetch('/api/parent/create-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({})) as { child?: { name?: string } }
        const childName = data.child?.name ?? name.trim()
        toast(`Profile created for ${childName}!`)
        router.push('/parent/dashboard')
        return
      }

      const data = await res.json().catch(() => ({})) as { error?: string; missingScopes?: string[] }
      if (res.status === 409 && data.error?.toLowerCase().includes('email')) {
        setFieldErrors({ email: 'This email is already registered on Spinzy.' })
      } else if (res.status === 409 && data.error?.toLowerCase().includes('maximum')) {
        setFormError('You have reached the maximum of 3 linked children.')
      } else {
        setFormError(data.error ?? "Couldn't create profile. Please try again.")
      }
    } catch (err) {
      setFormError("Couldn't create profile. Please check your connection.")
      logger.error('Create child profile failed', { className: CLASS_NAME, error: String(err) })
    } finally {
      setLoading(false)
    }
  }

  const err = (field: string) =>
    fieldErrors[field] ? (
      <p className="mt-1 text-xs text-[#E24B4A] dark:text-red-400">{fieldErrors[field]}</p>
    ) : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Child&apos;s full name <span className="text-[#E24B4A]">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: '' })) }}
          placeholder="e.g. Arjun Sharma"
          className={[
            'w-full min-h-[44px] px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent',
            fieldErrors.name ? 'border-[#E24B4A]' : 'border-gray-200 dark:border-gray-700',
          ].join(' ')}
        />
        {err('name')}
      </div>

      {/* Date of birth */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Date of birth <span className="text-[#E24B4A]">*</span>
        </label>
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => { setDateOfBirth(e.target.value); setFieldErrors((p) => ({ ...p, dateOfBirth: '' })) }}
          max={new Date().toISOString().split('T')[0]}
          className={[
            'w-full min-h-[44px] px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent',
            fieldErrors.dateOfBirth ? 'border-[#E24B4A]' : 'border-gray-200 dark:border-gray-700',
          ].join(' ')}
        />
        {err('dateOfBirth')}
      </div>

      {/* Grade + Board row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Grade <span className="text-[#E24B4A]">*</span>
          </label>
          <select
            value={grade}
            onChange={(e) => { setGrade(e.target.value); setFieldErrors((p) => ({ ...p, grade: '' })) }}
            className={[
              'w-full min-h-[44px] rounded-lg border bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7]',
              fieldErrors.grade ? 'border-[#E24B4A]' : 'border-gray-200 dark:border-gray-700',
            ].join(' ')}
          >
            <option value="">Select</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>Class {g}</option>
            ))}
          </select>
          {err('grade')}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Board <span className="text-[#E24B4A]">*</span>
          </label>
          <select
            value={board}
            onChange={(e) => { setBoard(e.target.value); setFieldErrors((p) => ({ ...p, board: '' })) }}
            className={[
              'w-full min-h-[44px] rounded-lg border bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7]',
              fieldErrors.board ? 'border-[#E24B4A]' : 'border-gray-200 dark:border-gray-700',
            ].join(' ')}
          >
            <option value="">Select</option>
            {BOARDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          {err('board')}
        </div>
      </div>

      {/* Medium */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Medium of instruction <span className="text-[#E24B4A]">*</span>
        </label>
        <div className="flex gap-2">
          {MEDIUMS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMedium(m); setFieldErrors((p) => ({ ...p, medium: '' })) }}
              className={[
                'flex-1 min-h-[44px] rounded-lg py-2 text-sm font-medium transition-colors',
                medium === m
                  ? 'bg-[#EEEDFE] text-[#534AB7] dark:bg-indigo-900/30 dark:text-indigo-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                fieldErrors.medium ? 'ring-1 ring-[#E24B4A]' : '',
              ].join(' ')}
            >
              {m}
            </button>
          ))}
        </div>
        {err('medium')}
      </div>

      {/* Relationship */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Your relationship to this child
        </label>
        <select
          value={relationship}
          onChange={(e) => setRelationship(e.target.value as 'father' | 'mother' | 'guardian')}
          className="w-full min-h-[44px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
        >
          <option value="guardian">Guardian</option>
          <option value="father">Father</option>
          <option value="mother">Mother</option>
        </select>
      </div>

      {/* Child email (optional) */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Child&apos;s email address <span className="text-gray-400 font-normal">(optional -- for login)</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: '' })) }}
          placeholder="child@email.com"
          className={[
            'w-full min-h-[44px] px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent',
            fieldErrors.email ? 'border-[#E24B4A]' : 'border-gray-200 dark:border-gray-700',
          ].join(' ')}
        />
        {err('email')}
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Your child can use this to log in later. You can add it after too.
        </p>
      </div>

      {/* Consent */}
      <div className={[
        'rounded-lg border p-3',
        fieldErrors.consent ? 'border-[#E24B4A] bg-[#FCEBEB] dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50',
      ].join(' ')}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => { setConsentGiven(e.target.checked); setFieldErrors((p) => ({ ...p, consent: '' })) }}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#534AB7] focus:ring-[#534AB7]"
          />
          <span className="text-xs text-gray-600 dark:text-gray-300">
            I confirm I am the parent or guardian of this child and have the authority to create an account on their behalf. I consent to Spinzy processing their learning data for educational purposes.
          </span>
        </label>
        {err('consent')}
      </div>

      {/* Form-level error */}
      {formError && (
        <div className="rounded-lg bg-[#FCEBEB] dark:bg-red-900/20 px-4 py-3 text-sm text-[#E24B4A] dark:text-red-400">
          {formError}
        </div>
      )}

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
          disabled={loading}
          className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[#534AB7] py-2 text-sm font-semibold text-white hover:bg-[#3C3489] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading && <SpinnerLoader size="small" color="#ffffff" />}
          {loading ? 'Creating...' : 'Create profile'}
        </button>
      </div>
    </form>
  )
}

// ── Root component ──────────────────────────────────────────────────────

export default function LinkChildForm({ defaultTab }: { defaultTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(defaultTab ?? 'link')

  return (
    <div className="space-y-5">
      {/* Tab nav */}
      <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 gap-1">
        <button
          type="button"
          onClick={() => setTab('link')}
          className={[
            'flex-1 min-h-[44px] rounded-lg py-2 text-sm font-medium transition-colors',
            tab === 'link'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
          ].join(' ')}
        >
          My child is on Spinzy
        </button>
        <button
          type="button"
          onClick={() => setTab('create')}
          className={[
            'flex-1 min-h-[44px] rounded-lg py-2 text-sm font-medium transition-colors',
            tab === 'create'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-50 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
          ].join(' ')}
        >
          New profile
        </button>
      </div>

      {tab === 'link' ? (
        <LinkExistingForm onSwitchToCreate={() => setTab('create')} />
      ) : (
        <CreateProfileForm />
      )}
    </div>
  )
}
