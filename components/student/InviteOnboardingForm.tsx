'use client'

/**
 * FILE OBJECTIVE:
 * - Pre-populated activation form for students arriving via a parent-sent invite link.
 * - Parent-supplied fields (name, grade, board, medium) are shown read-only.
 * - parentEmail field and OTP gate are hidden (parent already verified).
 * - Student sets their password and submits POST /api/student/activate-invite.
 *
 * EDIT LOG:
 * - 2026-05-29 | claude | created for parent-invite child activation flow
 */

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import { ONBOARDING_THEME_CLASSES } from '@/lib/theme/componentClasses'

const {
  pageBackground: PAGE_BACKGROUND_CLASS,
  pageAccent: PAGE_ACCENT_CLASS,
  container: CONTAINER_CLASS,
  fieldLabel: FIELD_LABEL_CLASS,
  input: INPUT_CLASS,
  primaryButton: PRIMARY_BUTTON_CLASS,
  inlineError: INLINE_ERROR_CLASS,
  bannerError: BANNER_ERROR_CLASS,
  decorativeCard: DECORATIVE_CARD_CLASS,
  sectionCard: SECTION_CARD_CLASS,
} = ONBOARDING_THEME_CLASSES

export interface InviteOnboardingInitialValues {
  name: string
  email: string | null
  grade: string | null
  board: string | null
  medium: string | null
  dateOfBirth: string | null
}

interface InviteOnboardingFormProps {
  studentId: string
  token: string
  initialValues: InviteOnboardingInitialValues
  parentLinked: boolean
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <label className={FIELD_LABEL_CLASS}>{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
        <span className="flex-1 text-sm text-foreground">{value || '--'}</span>
        <span className="text-xs text-muted-foreground">Set by parent</span>
      </div>
    </div>
  )
}

export default function InviteOnboardingForm({
  token,
  initialValues,
}: InviteOnboardingFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    setGlobalError('')
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/student/activate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json() as { success?: boolean; error?: string; redirectTo?: string }
      if (!res.ok) {
        setGlobalError(data.error ?? "Couldn't activate your account. Please try again.")
        return
      }
      // Sign in with the newly created credentials
      if (initialValues.email) {
        const signInResult = await signIn('credentials', {
          email: initialValues.email,
          password,
          redirect: false,
        })
        if (signInResult?.error) {
          // Activation succeeded but auto-sign-in failed -- send to login
          router.replace('/auth/login?activated=1')
          return
        }
      }
      router.replace(data.redirectTo ?? '/student/dashboard')
    } catch {
      setGlobalError("Couldn't activate your account. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`${PAGE_BACKGROUND_CLASS} relative overflow-hidden px-4 py-8`}>
      <div className={PAGE_ACCENT_CLASS} />
      <div className={CONTAINER_CLASS}>

        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <Logo variant="auth" />
          </div>
          <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary-bg px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Activate your account
          </span>
          <h1 className="font-brand text-2xl font-bold text-foreground">
            {initialValues.name ? `Welcome, ${initialValues.name}!` : 'Welcome to Spinzy!'}
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Your parent has set up your account. Choose a password to get started.
          </p>
        </div>

        <div className={DECORATIVE_CARD_CLASS}>
          <div className={SECTION_CARD_CLASS}>

            <div className="rounded-2xl border border-primary/15 bg-gradient-to-r from-primary-bg via-card to-brand-primary-bg/20 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Pre-filled by your parent</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Contact your parent to change these details.
              </p>
            </div>

            {initialValues.name && <ReadOnlyField label="Name" value={initialValues.name} />}
            {initialValues.email && <ReadOnlyField label="Email" value={initialValues.email} />}
            {initialValues.grade && <ReadOnlyField label="Class" value={`Class ${initialValues.grade}`} />}
            {initialValues.board && <ReadOnlyField label="Board" value={initialValues.board.toUpperCase()} />}

            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Set your password
              </p>

              <div className="space-y-1">
                <label htmlFor="invite-password" className={FIELD_LABEL_CLASS}>
                  Password <span className="text-error">*</span>
                </label>
                <input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className={INPUT_CLASS}
                />
                {fieldErrors.password && <p className={INLINE_ERROR_CLASS}>{fieldErrors.password}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="invite-confirm-password" className={FIELD_LABEL_CLASS}>
                  Confirm password <span className="text-error">*</span>
                </label>
                <input
                  id="invite-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className={INPUT_CLASS}
                />
                {fieldErrors.confirmPassword && <p className={INLINE_ERROR_CLASS}>{fieldErrors.confirmPassword}</p>}
              </div>
            </div>

            {globalError && (
              <div className={BANNER_ERROR_CLASS}>{globalError}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={PRIMARY_BUTTON_CLASS}
            >
              {submitting ? 'Activating...' : 'Activate my account'}
            </button>

          </div>
        </div>
      </div>
    </div>
  )
}
