'use client'

/**
 * FILE OBJECTIVE:
 * - /student/onboarding page
 * - Single-page form that captures student academic profile (name, DOB, language,
 *   board, grade, subjects, WhatsApp). Always shows parent contact fields, while
 *   only students under DPDP_MINOR_AGE must complete the parent verification flow
 *   before activating the account.
 * - Fetches boards/grades/subjects/languages dynamically from /api/academic-hierarchy.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/onboarding/parentWhatsapp.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-06 | claude | created for Google-auth onboarding flow
 * - 2026-05-07T00:00:00Z | copilot | replace hardcoded colors with theme classes and refresh onboarding visual styling
 * - 2026-05-07T00:00:00Z | copilot | move onboarding form/modal style recipes to lib/theme/componentClasses for theme-level reuse
 * - 2026-05-10T00:00:00Z | copilot | always show parent contact fields so older students can add parent info in edit mode
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Logo from '@/components/Logo'
import { DPDP_MINOR_AGE } from '@/lib/constants/age'
import { ONBOARDING_THEME_CLASSES } from '@/lib/theme/componentClasses'

// ── Types from academic-hierarchy API ─────────────────────────────────────────

interface AcademicSubject { id: string; name: string; slug: string }
interface AcademicClass { id: string; grade: number; slug: string; subjects: AcademicSubject[] }
interface AcademicBoard { id: string; name: string; slug: string; classes: AcademicClass[] }
interface AcademicLanguage { code: string; name: string }
interface AcademicHierarchy {
  boards: AcademicBoard[]
  languages: AcademicLanguage[]
}

// Narrow shape of session.user fields accessed in this component
interface OnboardingSessionUser {
  name?: string | null
  onboardingComplete?: boolean
  accountStatus?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SUBJECTS = 6
const {
  pageBackground: PAGE_BACKGROUND_CLASS,
  pageAccent: PAGE_ACCENT_CLASS,
  container: CONTAINER_CLASS,
  fieldLabel: FIELD_LABEL_CLASS,
  input: INPUT_CLASS,
  primaryButton: PRIMARY_BUTTON_CLASS,
  secondaryAction: SECONDARY_ACTION_CLASS,
  segmentBase: SEGMENT_BASE_CLASS,
  segmentSelected: SEGMENT_SELECTED_CLASS,
  subjectDisabled: SUBJECT_DISABLED_CLASS,
  inlineError: INLINE_ERROR_CLASS,
  bannerError: BANNER_ERROR_CLASS,
  bannerWarning: BANNER_WARNING_CLASS,
  bannerSuccessIcon: BANNER_SUCCESS_ICON_CLASS,
  phoneWrapper: PHONE_WRAPPER_CLASS,
  phonePrefix: PHONE_PREFIX_CLASS,
  phoneInput: PHONE_INPUT_CLASS,
  otpInput: OTP_INPUT_CLASS,
  decorativeCard: DECORATIVE_CARD_CLASS,
  sectionCard: SECTION_CARD_CLASS,
} = ONBOARDING_THEME_CLASSES

// Server returns errors under these keys; map to UI field names
const SERVER_KEY_MAP: Record<string, string> = {
  class_grade: 'grade',
  preferred_language: 'language',
  parent_whatsapp: 'parentWhatsapp',
  parent_email: 'parentEmail',
}

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

/** Prepend +91 if value has digits but no country code prefix */
function withCountryCode(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (raw.trimStart().startsWith('+')) return raw.trim()
  return `+91${digits}`
}

function mapServerFieldErrors(serverErrors: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {}
  for (const [k, v] of Object.entries(serverErrors)) {
    mapped[SERVER_KEY_MAP[k] ?? k] = v
  }
  return mapped
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
  const searchParams = useSearchParams()
  const isEditMode = searchParams.get('edit') === '1'

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
    const user = session?.user as OnboardingSessionUser | undefined
    if (!isEditMode && user?.onboardingComplete && user?.accountStatus === 'active') {
      router.replace('/dashboard')
      return
    }
    if (user?.name) {
      setForm((f) => {
        if (f.name) return f
        return { ...f, name: user.name as string }
      })
    }
  }, [isEditMode, status, session, router])

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
        setHierarchyError('')
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

  function selectBoard(slug: string) {
    setForm((f) => ({ ...f, boardSlug: slug, grade: '', subjectSlugs: [] }))
  }

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
      const hasWhatsapp = withCountryCode(form.parentWhatsapp).replace(/\D/g, '').length >= 10
      if (!hasEmail && !hasWhatsapp) {
        errs.parentContact = `Students under ${DPDP_MINOR_AGE} need a parent contact for verification. Add at least one.`
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
          whatsapp_phone: form.whatsapp ? withCountryCode(form.whatsapp) : undefined,
          parent_email: form.parentEmail || undefined,
          parent_whatsapp: form.parentWhatsapp ? withCountryCode(form.parentWhatsapp) : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.fieldErrors) {
          setFieldErrors((prev) => ({ ...prev, ...mapServerFieldErrors(data.fieldErrors) }))
        } else {
          setGlobalError(data.message ?? "Couldn't save your details. Please try again.")
        }
        return
      }

      if (isMinor) {
        await sendOtp()
        setView('otp')
      } else {
        router.replace('/student/onboarding/exam-date')
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
        setTimeout(() => router.replace('/student/onboarding/exam-date'), 1500)
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
      <div className={`${PAGE_BACKGROUND_CLASS} flex items-center justify-center`}>
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your onboarding form...</p>
        </div>
      </div>
    )
  }

  // ── Done ────────────────────────────────────────────────────────────────────
  if (view === 'done') {
    return (
      <div className={`${PAGE_BACKGROUND_CLASS} flex items-center justify-center px-4`}>
        <div className="text-center space-y-4">
          <div className={`${BANNER_SUCCESS_ICON_CLASS} mx-auto`}>
            <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-brand text-xl font-bold text-foreground">Account verified!</h2>
          <p className="text-sm text-muted-foreground">Taking you to your dashboard...</p>
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
      <div className={`${PAGE_BACKGROUND_CLASS} relative flex items-center justify-center overflow-hidden px-4`}>
        <div className={PAGE_ACCENT_CLASS} />
        <div className="relative w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <Logo variant="auth" />
            </div>
            <h1 className="font-brand text-xl font-bold text-foreground">Parent verification</h1>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to {sentDesc}. Ask your parent to share it with you.
            </p>
          </div>

          <div className={DECORATIVE_CARD_CLASS}>
            <div className={`${SECTION_CARD_CLASS} space-y-5`}>
              <div className="rounded-2xl border border-primary/15 bg-primary-bg px-4 py-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Approval step</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter the code from your parent to finish account setup.
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
              className={OTP_INPUT_CLASS}
            />
                {otpError && <p className="text-center text-sm text-error">{otpError}</p>}
              </div>

              <button
                onClick={handleOtpVerify}
                disabled={otpSubmitting || otpCode.length !== 6}
                className={PRIMARY_BUTTON_CLASS}
              >
                {otpSubmitting ? 'Verifying...' : 'Verify code'}
              </button>

              <div className="text-center">
                {otpCountdown > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Resend code in {Math.floor(otpCountdown / 60)}:{String(otpCountdown % 60).padStart(2, '0')}
                  </p>
                ) : (
                  <button
                    onClick={() => { sendOtp(); setOtpCode('') }}
                    disabled={otpSending}
                    className={SECONDARY_ACTION_CLASS}
                  >
                    {otpSending ? 'Sending...' : 'Resend code'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Form view ───────────────────────────────────────────────────────────────
  return (
    <div className={`${PAGE_BACKGROUND_CLASS} relative overflow-hidden px-4 py-8`}>
      <div className={PAGE_ACCENT_CLASS} />
      <div className={CONTAINER_CLASS}>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Logo variant="auth" />
          </div>
          <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary-bg px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Student onboarding
          </span>
          <h1 className="font-brand text-2xl font-bold text-foreground">Set up your profile</h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Help Vidya personalise your learning experience.
          </p>
        </div>

        {hierarchyError && (
          <div className={BANNER_ERROR_CLASS}>
            {hierarchyError}
          </div>
        )}

        <div className={DECORATIVE_CARD_CLASS}>
          <div className={SECTION_CARD_CLASS}>

          <div className="rounded-2xl border border-primary/15 bg-gradient-to-r from-primary-bg via-card to-brand-primary-bg/20 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Personalise your path</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your board, class, and subjects so Vidya can shape the right starting point.
            </p>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label htmlFor="student-name" className={FIELD_LABEL_CLASS}>
              Your name <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="student-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Rahul"
              className={INPUT_CLASS}
            />
          </div>

          {/* Date of Birth */}
          <div className="space-y-1">
            <label htmlFor="student-dob" className={FIELD_LABEL_CLASS}>
              Date of birth <span className="text-error">*</span>
            </label>
            <input
              id="student-dob"
              type="date"
              value={form.dob}
              max={todayIso()}
              onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
              className={INPUT_CLASS}
            />
            {fieldErrors.dob && <p className={INLINE_ERROR_CLASS}>{fieldErrors.dob}</p>}
          </div>

          {/* Learning Language */}
          {hierarchy?.languages && hierarchy.languages.length > 0 && (
            <div className="space-y-1">
              <label className={FIELD_LABEL_CLASS}>
                Learning language <span className="text-error">*</span>
              </label>
              <div className="flex gap-3">
                {hierarchy.languages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, language: lang.code }))}
                    className={`min-h-[44px] flex-1 px-3 py-2.5 ${SEGMENT_BASE_CLASS}
                      ${form.language === lang.code
                        ? SEGMENT_SELECTED_CLASS
                        : ''
                      }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
              {fieldErrors.language && <p className={INLINE_ERROR_CLASS}>{fieldErrors.language}</p>}
            </div>
          )}

          {/* Board */}
          {hierarchy?.boards && hierarchy.boards.length > 0 && (
            <div className="space-y-1">
              <label className={FIELD_LABEL_CLASS}>
                Board <span className="text-error">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {hierarchy.boards.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => selectBoard(b.slug)}
                    className={`min-h-[44px] px-4 py-2 ${SEGMENT_BASE_CLASS}
                      ${form.boardSlug === b.slug
                        ? SEGMENT_SELECTED_CLASS
                        : ''
                      }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
              {fieldErrors.board && <p className={INLINE_ERROR_CLASS}>{fieldErrors.board}</p>}
            </div>
          )}

          {/* Grade -- shown after board is selected */}
          {form.boardSlug && availableGrades.length > 0 && (
            <div className="space-y-1">
              <label className={FIELD_LABEL_CLASS}>
                Class <span className="text-error">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availableGrades.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectGrade(String(c.grade))}
                    className={`h-11 w-12 ${SEGMENT_BASE_CLASS}
                      ${form.grade === String(c.grade)
                        ? SEGMENT_SELECTED_CLASS
                        : ''
                      }`}
                  >
                    {c.grade}
                  </button>
                ))}
              </div>
              {fieldErrors.grade && <p className={INLINE_ERROR_CLASS}>{fieldErrors.grade}</p>}
            </div>
          )}

          {/* Subjects -- shown after grade is selected */}
          {form.grade && availableSubjects.length > 0 && (
            <div className="space-y-1">
              <label className={FIELD_LABEL_CLASS}>
                Subjects <span className="text-error">*</span>
                <span className="ml-1 font-normal text-muted-foreground">
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
                      className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
                        ${selected
                          ? 'border-primary bg-primary-bg text-primary shadow-sm'
                          : disabled
                            ? SUBJECT_DISABLED_CLASS
                            : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-brand-primary-bg/30'
                        }`}
                    >
                      {s.name}
                    </button>
                  )
                })}
              </div>
              {fieldErrors.subjects && <p className={INLINE_ERROR_CLASS}>{fieldErrors.subjects}</p>}
            </div>
          )}

          {/* WhatsApp (optional) */}
          <div className="space-y-1">
            <label htmlFor="student-whatsapp" className={FIELD_LABEL_CLASS}>
              WhatsApp number <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <PhoneInput
              inputId="student-whatsapp"
              value={form.whatsapp}
              onChange={(v) => setForm((f) => ({ ...f, whatsapp: v }))}
              placeholder="98765 43210"
            />
            <p className="text-xs text-muted-foreground">For session reminders and progress alerts.</p>
          </div>

          {/* Parent contact -- always visible; required only for students under the age gate */}
          <div className="space-y-4 border-t border-warning/15 pt-2">
            <div className={BANNER_WARNING_CLASS}>
              <p className="text-sm font-semibold text-warning">
                {isMinor ? 'Parent verification required' : 'Parent contact information'}
              </p>
              <p className="mt-0.5 text-xs text-warning/80">
                {isMinor
                  ? `Students under ${DPDP_MINOR_AGE} need a parent to approve the account. We will send a one-time code to verify.`
                  : 'Adding a parent email or WhatsApp number will keep them updated on the sessions.'}
              </p>
            </div>

            {/* Parent Email */}
            <div className="space-y-1">
              <label htmlFor="parent-email" className={FIELD_LABEL_CLASS}>
                Parent email
              </label>
              <input
                id="parent-email"
                type="email"
                value={form.parentEmail}
                onChange={(e) => setForm((f) => ({ ...f, parentEmail: e.target.value }))}
                placeholder="parent@example.com"
                className={INPUT_CLASS}
              />
              {fieldErrors.parentEmail && <p className={INLINE_ERROR_CLASS}>{fieldErrors.parentEmail}</p>}
            </div>

            {/* Parent WhatsApp */}
            <div className="space-y-1">
              <label htmlFor="parent-whatsapp" className={FIELD_LABEL_CLASS}>
                Parent WhatsApp number
              </label>
              <PhoneInput
                inputId="parent-whatsapp"
                value={form.parentWhatsapp}
                onChange={(v) => setForm((f) => ({ ...f, parentWhatsapp: v }))}
                placeholder="98765 43210"
              />
              {fieldErrors.parentWhatsapp && <p className={INLINE_ERROR_CLASS}>{fieldErrors.parentWhatsapp}</p>}
              <p className="text-xs text-muted-foreground">
                {isMinor
                  ? 'The verification code will be sent to whichever channels you provide. At least one is required.'
                  : 'Adding a parent contact is optional for older students.'}
              </p>
            </div>

            {fieldErrors.parentContact && (
              <p className={INLINE_ERROR_CLASS}>{fieldErrors.parentContact}</p>
            )}
            </div>

          {globalError && (
            <p className="text-center text-sm text-error">{globalError}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={PRIMARY_BUTTON_CLASS}
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
    </div>
  )
}

// ── PhoneInput -- +91 prefix with editable suffix ────────────────────────────

function PhoneInput({
  inputId,
  value,
  onChange,
  placeholder,
}: {
  inputId?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className={PHONE_WRAPPER_CLASS}>
      <span className={PHONE_PREFIX_CLASS}>
        +91
      </span>
      <input
        id={inputId}
        type="tel"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
        placeholder={placeholder ?? '98765 43210'}
        inputMode="numeric"
        className={PHONE_INPUT_CLASS}
      />
    </div>
  )
}