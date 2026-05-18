/**
 * FILE OBJECTIVE:
 * - Render the shared sign-in page and support role-aware callback routing for onboarding flows.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/public/auth/signin/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add Google error banner and retry UI for ?error= callback failures
 * - 2026-05-11T00:00:00Z | copilot | add safe callbackUrl handling and parent-intent redirect support for invite onboarding
 */
'use client'

import { Suspense, useMemo, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Logo from '@/components/Logo'
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier'
import { Spinner, GoogleLogo } from '@/components/UI/design-system'

const DEFAULT_CALLBACK_URL = '/dashboard'
const PARENT_ROLE_QUERY_VALUE = 'parent'
const PARENT_ONBOARDING_PATH = '/parent/onboarding'
const GOOGLE_ERROR_CODES = new Set(['Callback', 'OAuthCallback', 'OAuthSignin', 'OAuthAccountNotLinked'])

function sanitizeCallbackUrl(rawValue: string | null): string {
  if (!rawValue || !rawValue.startsWith('/')) {
    return DEFAULT_CALLBACK_URL
  }

  if (rawValue.startsWith('//')) {
    return DEFAULT_CALLBACK_URL
  }

  return rawValue
}

function buildParentOnboardingCallback(inviteCode: string): string {
  if (!inviteCode) {
    return PARENT_ONBOARDING_PATH
  }

  return `${PARENT_ONBOARDING_PATH}?inviteCode=${encodeURIComponent(inviteCode)}`
}

function AuthContent() {
  const searchParams = useSearchParams()
  const roleIntent = searchParams.get('role')
  const inviteCodeFromQuery = String(searchParams.get('inviteCode') ?? '').trim().toUpperCase().slice(0, 16)
  const callbackUrlFromQuery = sanitizeCallbackUrl(searchParams.get('callbackUrl'))
  const authError = searchParams.get('error') ?? ''
  const googleFailed = GOOGLE_ERROR_CODES.has(authError)
  const callbackUrl = useMemo(() => {
    if (roleIntent === PARENT_ROLE_QUERY_VALUE) {
      return buildParentOnboardingCallback(inviteCodeFromQuery)
    }

    return callbackUrlFromQuery
  }, [roleIntent, inviteCodeFromQuery, callbackUrlFromQuery])

  const [email, setEmail] = useState(
    searchParams.get('email') ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('spinzy_signup_email') || '' : '')
  )
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleEmailSignIn() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await signIn('email', {
        email,
        callbackUrl,
        redirect: false,
      })
      if (result?.error) {
        setError('Could not send email. Please try again.')
      } else {
        setEmailSent(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-primary-bg rounded-full flex items-center justify-center mx-auto text-3xl">📧</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Check your email
          </h1>
          <p className="text-gray-500 text-sm">
            We sent a sign-in link to <strong>{email}</strong>.
            Click the link to continue.
          </p>
          <button
            onClick={() => setEmailSent(false)}
            className="text-sm text-primary hover:underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo variant="auth" className="mb-6" />
          </div>
          <div>
            <h1 className="text-xl font-brand font-bold text-gray-900 dark:text-white">Welcome to Spinzy Academy</h1>
            <p className="text-sm text-muted-foreground mt-1">AI home tutor · CBSE Grades 1-12</p>
          </div>
        </div>

        {/* Google sign-in error banner */}
        {googleFailed && (
          <div className="rounded-xl bg-error-bg border border-brand-danger/20 px-4 py-3 text-sm text-error">
            Google sign-in did not complete. Please try again -- if the problem continues, clear your browser cookies.
          </div>
        )}

        {/* Google Sign In */}
        <button
          onClick={() => signIn('google', { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 px-4 py-3
                     border border-gray-300 dark:border-gray-600 rounded-xl
                     bg-white dark:bg-gray-900 hover:bg-gray-50
                     dark:hover:bg-gray-800 transition-colors
                     text-gray-700 dark:text-gray-200 font-medium text-sm
                     min-h-[44px]"
        >
          <GoogleLogo />
          {googleFailed ? 'Retry with Google' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"/>
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"/>
        </div>

        {/* Email magic link */}
        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmailSignIn()}
            placeholder="Your email address"
            className="w-full px-4 py-3 rounded-xl border border-gray-300
                       dark:border-gray-600 bg-white dark:bg-gray-900
                       text-gray-900 dark:text-white placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-primary
                       focus:border-transparent text-sm"
          />
          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}
          <button
            onClick={handleEmailSignIn}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover
                       text-white font-medium text-sm transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send sign-in link →'}
          </button>
        </div>

        {/* Trust line */}
        <p className="text-center text-xs text-gray-400">{FREE_SESSIONS_TEXT} · No credit card required</p>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    }>
      <AuthContent />
    </Suspense>
  )
}