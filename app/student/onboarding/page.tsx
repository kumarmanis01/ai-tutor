'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import { DPDP_MINOR_AGE } from '@/lib/constants/age'

// ── Types from academic-hierarchy API ─────────────────────────────────────────

interface AcademicSubject { id: string; name: string; slug: string }
interface AcademicClass { id: string; grade: number; slug: string; subjects: AcademicSubject[] }
interface AcademicBoard { id: string; name: string; slug: string; classes: AcademicClass[] }
interface AcademicLanguage { code: string; name: string }
interface AcademicHierarchy {
  boards: AcademicBoard[]
  languages: AcademicLanguage[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SUBJECTS = 6

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

// ── Types ─────────────────────────────────────────────────────────────────────

type View = 'loading-hierarchy' | 'form' | 'otp' | 'done'

interface FormState {
  name: string
  dob: string
  language: string
  boardSlug: string
  grade: string
  subjectSlugs: string[]
  whatsapp: string
  parentEmail: string
  parentWhatsapp: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudentOnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [view, setView] = useState<View>('loading-hierarchy')
  const [hierarchy, setHierarchy] = useState<AcademicHierarchy | null>(null)
  const [hierarchyError, setHierarchyError] = useState('')

  const [form, setForm] = useState<FormState>({
    name: '',
    dob: '',
    language: '',
    boardSlug: '',
    grade: '',
    subjectSlugs: [],
    whatsapp: '',
    parentEmail: '',
    parentWhatsapp: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')

  // OTP state
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpSubmitting, setOtpSubmitting] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpSentTo, setOtpSentTo] = useState<{ email?: string; whatsapp?: string }>({})
  const [otpCountdown, setOtpCountdown] = useState(0)

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.replace('/auth/signup')
      return
    }
    const user = session?.user as any
    if (user?.onboardingComplete && user?.accountStatus === 'active') {
      router.replace('/dashboard')
      return
    }
    if (user?.name) {
      setForm((f) => ({ ...f, name: f.name || user.name }))
    }
  }, [status, session, router])

  // ── Fetch hierarchy ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading' || status === 'unauthenticated') return

    const loadHierarchy = async () => {
      try {
        const response = await fetch('/api/academic-hierarchy')

        if (!response.ok) {
          let errorMessage = "Couldn't load form options. Please refresh and try again."

          try {
            const errorPayload = await response.json() as { error?: string; message?: string }
            errorMessage = errorPayload.message || errorPayload.error || errorMessage
          } catch {
            // Intentionally ignore JSON parsing failures for error payloads and
            // fall back to the default user-facing message.
          }

          throw new Error(errorMessage)
        }

        const data = await response.json() as AcademicHierarchy
        setHierarchy(data)
        setHierarchyError(null)

        // Default language to first option
        if (data.languages?.length > 0) {
          setForm((f) => ({ ...f, language: f.language || data.languages[0].code }))
        }

        setView('form')
      } catch (error) {
        setHierarchyError(
          error instanceof Error
            ? error.message
            : "Couldn't load form options. Please refresh and try again.",
        )
        setView('form')
      }
    }

    void loadHierarchy()
  }, [status])

  // ── OTP resend countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (otpCountdown <= 0) return
    const t = setTimeout(() => setOtpCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [otpCountdown])

  // ── Derived data ────────────────────────────────────────────────────────────
  const selectedBoard = hierarchy?.boards.find((b) => b.slug === form.boardSlug)
  const availableGrades = selectedBoard?.classes ?? []
  const selectedClass = availableGrades.find((c) => String(c.grade) === form.grade)
  const availableSubjects = selectedClass?.subjects ?? []

  const age = form.dob ? calcAge(form.dob) : null
  const isMinor = age !== null && age < DPDP_MINOR_AGE

  // Reset grade/subjects when board changes
  function selectBoard(slug: string) {
    setForm((f) => ({ ...f, boardSlug: slug, grade: '', subjectSlugs: [] }))
  }

  // Reset subjects when grade changes
  function selectGrade(grade: string) {
    setForm((f) => ({ ...f, grade, subjectSlugs: [] }))
  }

  function toggleSubject(slug: string) {
    setForm((f) => {
      const has = f.subjectSlugs.includes(slug)
      if (has) return { ...f, subjectSlugs: f.subjectSlugs.filter((s) => s !== slug) }
      if (f.subjectSlugs.length >= MAX_SUBJECTS) return f
      return { ...f, subjectSlugs: [...f.subjectSlugs, slug] }
    })
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  function validateForm(): boolean {
    const errs: Record<string, string> = {}
    if (!form.dob) errs.dob = 'Date of birth is required'
    if (!form.language) errs.language = 'Learning language is required'
    if (!form.boardSlug) errs.board = 'Board is required'
    if (!form.grade) errs.grade = 'Class is required'
    if (form.subjectSlugs.length === 0) errs.subjects = 'Select at least 1 subject'
    if (isMinor) {
      const hasEmail = form.parentEmail.includes('@')
      const hasWhatsapp = form.parentWhatsapp.replace(/\D/g, '').length >= 10
      if (!hasEmail && !hasWhatsapp) {
        errs.parentContact = `Students under ${DPDP_MINOR_AGE} need a parent contact for verification. Please add at least one.`
      }
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit form ─────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setGlobalError('')
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name || undefined,
          age: age ?? undefined,
          class_grade: form.grade,
          board: form.boardSlug,
          preferred_language: form.language,
          subjects: form.subjectSlugs,
          whatsapp_phone: form.whatsapp || undefined,
          parent_email: form.parentEmail || undefined,
          parent_whatsapp: form.parentWhatsapp || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.fieldErrors) {
          setFieldErrors((prev) => ({ ...prev, ...data.fieldErrors }))
        } else {
          setGlobalError(data.message ?? "Couldn't save your details. Please try again.")
        }
        return
      }

      if (isMinor) {
        await sendOtp()
        setView('otp')
      } else {
        router.replace('/dashboard')
      }
    } catch {
      setGlobalError("Couldn't save your details. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Send parent OTP ─────────────────────────────────────────────────────────
  const sendOtp = useCallback(async () => {
    setOtpSending(true)
    setOtpError('')
    try {
      const res = await fetch('/api/auth/parent/send-otp', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setOtpSentTo(data.sentTo ?? {})
        setOtpCountdown(data.expiresInSeconds ?? 300)
      } else {
        setOtpError(data.error ?? "Couldn't send the code. Please try again.")
      }
    } catch {
      setOtpError("Couldn't send the code. Please try again.")
    } finally {
      setOtpSending(false)
    }
  }, [])

  // ── Verify OTP ──────────────────────────────────────────────────────────────
  async function handleOtpVerify() {
    if (!/^\d{6}$/.test(otpCode)) {
      setOtpError('Enter the 6-digit code sent to your parent.')
      return
    }
    setOtpSubmitting(true)
    setOtpError('')
    try {
      const res = await fetch('/api/auth/parent/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode }),
      })
      const data = await res.json()
      if (res.ok) {
        setView('done')
        setTimeout(() => router.replace('/dashboard'), 1500)
      } else {
        setOtpError(data.error ?? 'Invalid or expired code. Please try again.')
      }
    } catch {
      setOtpError("Couldn't verify the code. Please try again.")
    } finally {
      setOtpSubmitting(false)
    }
  }

  // ── Loading states ──────────────────────────────────────────────────────────
  if (status === 'loading' || view === 'loading-hierarchy') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Done ────────────────────────────────────────────────────────────────────
  if (view === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-[#EAF3DE] rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Account verified!</h2>
          <p className="text-sm text-gray-500">Taking you to your dashboard...</p>
        </div>
      </div>
    )
  }

  // ── OTP view ────────────────────────────────────────────────────────────────
  if (view === 'otp') {
    const sentChannels: string[] = []
    if (otpSentTo.email) sentChannels.push(`email (${otpSentTo.email})`)
    if (otpSentTo.whatsapp) sentChannels.push(`WhatsApp (${otpSentTo.whatsapp})`)
    const sentDesc = sentChannels.length > 0 ? sentChannels.join(' and ') : 'your parent'

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <Logo variant="auth" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Parent verification</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              We sent a 6-digit code to {sentDesc}. Ask your parent to share it with you.
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] rounded-xl
                         border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-900
                         text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent"
            />
            {otpError && <p className="text-[#E24B4A] text-sm text-center">{otpError}</p>}
          </div>

          <button
            onClick={handleOtpVerify}
            disabled={otpSubmitting || otpCode.length !== 6}
            className="w-full py-3 min-h-[44px] rounded-xl bg-[#534AB7] hover:bg-[#4239a0]
                       text-white font-semibold text-sm transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {otpSubmitting ? 'Verifying...' : 'Verify code'}
          </button>

          <div className="text-center">
            {otpCountdown > 0 ? (
              <p className="text-xs text-gray-400">
                Resend code in {Math.floor(otpCountdown / 60)}:{String(otpCountdown % 60).padStart(2, '0')}
              </p>
            ) : (
              <button
                onClick={() => { sendOtp(); setOtpCode('') }}
                disabled={otpSending}
                className="text-sm text-[#534AB7] hover:underline disabled:opacity-50"
              >
                {otpSending ? 'Sending...' : 'Resend code'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Form view ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4">
      <div className="w-full max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Logo variant="auth" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Set up your profile</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Help Vidya personalise your learning experience.
          </p>
        </div>

        {hierarchyError && (
          <div className="bg-[#FCEBEB] border border-[#E24B4A]/20 rounded-xl px-4 py-3 text-sm text-[#E24B4A]">
            {hierarchyError}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 space-y-5">

          {/* Name */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Your name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Rahul"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent text-sm"
            />
          </div>

          {/* Date of Birth */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Date of birth <span className="text-[#E24B4A]">*</span>
            </label>
            <input
              type="date"
              value={form.dob}
              max={todayIso()}
              onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent text-sm"
            />
            {fieldErrors.dob && <p className="text-[#E24B4A] text-xs">{fieldErrors.dob}</p>}
          </div>

          {/* Learning Language */}
          {hierarchy?.languages && hierarchy.languages.length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Learning language <span className="text-[#E24B4A]">*</span>
              </label>
              <div className="flex gap-3">
                {hierarchy.languages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, language: lang.code }))}
                    className={`flex-1 py-2.5 min-h-[44px] rounded-xl border-2 text-sm font-medium transition-colors
                      ${form.language === lang.code
                        ? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#534AB7]/50'
                      }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
              {fieldErrors.language && <p className="text-[#E24B4A] text-xs">{fieldErrors.language}</p>}
            </div>
          )}

          {/* Board */}
          {hierarchy?.boards && hierarchy.boards.length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Board <span className="text-[#E24B4A]">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {hierarchy.boards.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => selectBoard(b.slug)}
                    className={`px-4 py-2 min-h-[44px] rounded-xl border-2 text-sm font-medium transition-colors
                      ${form.boardSlug === b.slug
                        ? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#534AB7]/50'
                      }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
              {fieldErrors.board && <p className="text-[#E24B4A] text-xs">{fieldErrors.board}</p>}
            </div>
          )}

          {/* Grade -- shown after board is selected */}
          {form.boardSlug && availableGrades.length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Class <span className="text-[#E24B4A]">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availableGrades.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectGrade(String(c.grade))}
                    className={`w-12 h-11 rounded-xl border-2 text-sm font-medium transition-colors
                      ${form.grade === String(c.grade)
                        ? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#534AB7]/50'
                      }`}
                  >
                    {c.grade}
                  </button>
                ))}
              </div>
              {fieldErrors.grade && <p className="text-[#E24B4A] text-xs">{fieldErrors.grade}</p>}
            </div>
          )}

          {/* Subjects -- shown after grade is selected */}
          {form.grade && availableSubjects.length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Subjects <span className="text-[#E24B4A]">*</span>
                <span className="text-gray-400 font-normal ml-1">
                  ({form.subjectSlugs.length}/{MAX_SUBJECTS} selected)
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availableSubjects.map((s) => {
                  const selected = form.subjectSlugs.includes(s.slug)
                  const disabled = !selected && form.subjectSlugs.length >= MAX_SUBJECTS
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSubject(s.slug)}
                      disabled={disabled}
                      className={`px-3 py-1.5 min-h-[36px] rounded-lg border text-xs font-medium transition-colors
                        ${selected
                          ? 'border-[#534AB7] bg-[#EEEDFE] text-[#534AB7]'
                          : disabled
                            ? 'border-gray-100 dark:border-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#534AB7]/50'
                        }`}
                    >
                      {s.name}
                    </button>
                  )
                })}
              </div>
              {fieldErrors.subjects && <p className="text-[#E24B4A] text-xs">{fieldErrors.subjects}</p>}
            </div>
          )}

          {/* WhatsApp (optional) */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              WhatsApp number <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              placeholder="+91 98765 43210"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent text-sm"
            />
            <p className="text-xs text-gray-400">For session reminders and progress alerts.</p>
          </div>

          {/* Parent contact -- shown when student is under DPDP age gate */}
          {isMinor && (
            <div className="pt-2 border-t border-[#FAEEDA] dark:border-gray-800 space-y-4">
              <div className="bg-[#FAEEDA] dark:bg-amber-950/30 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-[#BA7517]">Parent verification required</p>
                <p className="text-xs text-[#BA7517]/80 mt-0.5">
                  Students under {DPDP_MINOR_AGE} need a parent to approve the account.
                  We will send a one-time code to verify.
                </p>
              </div>

              {/* Parent Email */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Parent email
                </label>
                <input
                  type="email"
                  value={form.parentEmail}
                  onChange={(e) => setForm((f) => ({ ...f, parentEmail: e.target.value }))}
                  placeholder="parent@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent text-sm"
                />
              </div>

              {/* Parent WhatsApp */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Parent WhatsApp number
                </label>
                <input
                  type="tel"
                  value={form.parentWhatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, parentWhatsapp: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent text-sm"
                />
                <p className="text-xs text-gray-400">
                  The verification code will be sent to whichever channels you provide. At least one is required.
                </p>
              </div>

              {fieldErrors.parentContact && (
                <p className="text-[#E24B4A] text-xs">{fieldErrors.parentContact}</p>
              )}
            </div>
          )}

          {globalError && (
            <p className="text-[#E24B4A] text-sm text-center">{globalError}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 min-h-[44px] rounded-xl bg-[#534AB7] hover:bg-[#4239a0]
                       text-white font-semibold text-sm transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? 'Saving...'
              : isMinor
                ? 'Save and send verification code'
                : 'Start learning'}
          </button>
        </div>
      </div>
    </div>
  )
}
