/**
 * FILE OBJECTIVE:
 * - Multi-step student registration wizard (S0.1).
 *   Steps: Role → AgeGate → Profile → ParentContact → Success.
 *   Under-18 students see ParentContact step; over-18 skip directly to success.
 *   On success, calls onComplete with explore_token (under-18) or null (adult).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/registration/StudentRegistrationWizard.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 */

'use client'

import { useState } from 'react'
import { logger } from '@/lib/logger'

type Step = 'role' | 'age' | 'profile' | 'parent' | 'success'

interface SuccessData {
  isAdult: boolean
  exploreToken: string | null
  name: string
  contactMask: string | null
}

interface Props {
  onComplete?: (data: SuccessData) => void
}

function calcAge(dob: string): number | null {
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age
}

const BOARDS = ['CBSE', 'ICSE', 'State Board']
const GRADES = Array.from({ length: 12 }, (_, i) => i + 1)

export default function StudentRegistrationWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('role')
  const [dob, setDob] = useState('')
  const [isAdult, setIsAdult] = useState(false)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [board, setBoard] = useState('')
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [parentContact, setParentContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<SuccessData | null>(null)

  // --- Step: Role ---
  if (step === 'role') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome to Spinzy</h1>
        <p className="text-gray-500 dark:text-gray-400 text-center">How will you be using Spinzy?</p>
        <button
          className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#534AB7] text-white font-bold text-lg"
          onClick={() => setStep('age')}
        >
          {"I'm a Student"}
        </button>
        <a href="/login" className="text-[#534AB7] text-sm underline">
          {"I'm a Parent"}
        </a>
      </div>
    )
  }

  // --- Step: AgeGate ---
  if (step === 'age') {
    const age = dob ? calcAge(dob) : null
    const valid = age !== null && age >= 4 && age <= 25
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">When were you born?</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          We need this to comply with India's data protection laws.
        </p>
        <input
          type="date"
          aria-label="Date of birth"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="w-full max-w-xs min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
        />
        <button
          disabled={!valid}
          className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#534AB7] text-white font-bold text-lg disabled:opacity-40"
          onClick={() => {
            const a = calcAge(dob)!
            setIsAdult(a >= 18)
            setStep('profile')
          }}
        >
          Continue
        </button>
      </div>
    )
  }

  // --- Step: Profile ---
  if (step === 'profile') {
    const canNext = name.trim().length > 0 && grade !== '' && board !== ''
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">Tell us about yourself</h1>
        <input
          type="text"
          placeholder="First Name"
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-xs min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
        />
        <select
          aria-label="Grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="w-full max-w-xs min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
        >
          <option value="">Select Grade</option>
          {GRADES.map((g) => <option key={g} value={String(g)}>Class {g}</option>)}
        </select>
        <select
          aria-label="Board"
          value={board}
          onChange={(e) => setBoard(e.target.value)}
          className="w-full max-w-xs min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
        >
          <option value="">Select Board</option>
          {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <button
          disabled={!canNext}
          className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#534AB7] text-white font-bold text-lg disabled:opacity-40"
          onClick={() => setStep(isAdult ? 'success' : 'parent')}
        >
          Next
        </button>
        {isAdult && (
          <p className="text-xs text-gray-400">You are 18+. No parental consent needed.</p>
        )}
      </div>
    )
  }

  // --- Step: ParentContact (under-18 only) ---
  if (step === 'parent') {
    const canSend = parentContact.trim().length > 0
    async function handleSend() {
      setBusy(true)
      setError('')
      try {
        const res = await fetch('/api/v1/students/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, dateOfBirth: dob, grade, board, channel, parent_contact: parentContact }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Something went wrong. Please try again.')
          return
        }
        const sd: SuccessData = { isAdult: false, exploreToken: data.explore_token, name, contactMask: data.contactMask }
        setSuccess(sd)
        setStep('success')
        onComplete?.(sd)
      } catch (e) {
        logger.warn('StudentRegistrationWizard: register fetch failed', { error: String(e) })
        setError('Network error. Please check your connection.')
      } finally {
        setBusy(false)
      }
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
          Who should we ask for permission?
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Indian law requires parental consent for learners under 18. We will send a quick approval message.
        </p>
        <div className="flex w-full max-w-xs rounded-xl overflow-hidden border-2 border-gray-200 dark:border-slate-700">
          {(['whatsapp', 'email'] as const).map((c) => (
            <button
              key={c}
              className={`flex-1 min-h-[44px] text-sm font-semibold transition-colors ${channel === c ? 'bg-[#534AB7] text-white' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300'}`}
              onClick={() => { setChannel(c); setParentContact('') }}
            >
              {c === 'whatsapp' ? 'WhatsApp' : 'Email'}
            </button>
          ))}
        </div>
        {channel === 'whatsapp' ? (
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={parentContact}
            onChange={(e) => setParentContact(e.target.value)}
            className="w-full max-w-xs min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
          />
        ) : (
          <input
            type="email"
            placeholder="parent@example.com"
            value={parentContact}
            onChange={(e) => setParentContact(e.target.value)}
            className="w-full max-w-xs min-h-[44px] rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm"
          />
        )}
        {error && <p className="text-sm text-[#E24B4A] text-center">{error}</p>}
        <button
          disabled={!canSend || busy}
          className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#534AB7] text-white font-bold text-lg disabled:opacity-40"
          onClick={() => { void handleSend() }}
        >
          {busy ? 'Sending...' : 'Send Request & Start Exploring'}
        </button>
      </div>
    )
  }

  // --- Step: Success ---
  if (step === 'success') {
    if (isAdult || success?.isAdult) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">Welcome to Spinzy! 🎉</h1>
          <p className="text-gray-500 dark:text-gray-400 text-center">
            You are all set. Let us find out where you stand with a quick diagnostic quiz.
          </p>
          <a href="/student/diagnostic" className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#534AB7] text-white font-bold text-lg flex items-center justify-center">
            Take Diagnostic
          </a>
          <a href="/dashboard" className="text-[#534AB7] text-sm underline">Skip for now</a>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950 p-6 gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
          {`You're in, ${success?.name ?? name}! 🎉`}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-center">
          {`We've sent an approval request to ${success?.contactMask ?? parentContact}. While you wait, explore 3 free sample lessons!`}
        </p>
        <a
          href={`/explore?token=${encodeURIComponent(success?.exploreToken ?? '')}`}
          className="w-full max-w-xs min-h-[44px] rounded-2xl bg-[#534AB7] text-white font-bold text-lg flex items-center justify-center"
        >
          Start Exploring
        </a>
        <button
          className="text-[#534AB7] text-sm underline"
          onClick={() => { setStep('parent'); setParentContact('') }}
        >
          Send a different contact
        </button>
      </div>
    )
  }

  return null
}
