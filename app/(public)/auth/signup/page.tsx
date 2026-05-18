/**
 * FILE OBJECTIVE:
 * - Render the sign-up / sign-in entry page with Google OAuth and email magic-link options.
 *   Authenticated users are redirected to onboarding immediately.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/public/auth/signup/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add Google error banner and retry UI for ?error= callback failures
 */
'use client'

import { Suspense, useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier'
import { Spinner, GoogleLogo } from '@/components/UI/design-system'

const GOOGLE_ERROR_CODES = new Set(['Callback', 'OAuthCallback', 'OAuthSignin', 'OAuthAccountNotLinked'])

function AuthContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Redirect authenticated users so they don't re-trigger an OAuth flow
  // on top of an existing session, which causes OAuthAccountNotLinked errors.
  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.replace('/student/onboarding')
    }
  }, [status, session, router])

  const authError = searchParams.get('error') ?? ''
  const googleFailed = GOOGLE_ERROR_CODES.has(authError)

  const [email, _setEmail] = useState(
    searchParams.get('email') ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('spinzy_signup_email') || '' : '')
  )
  const [emailSent, setEmailSent] = useState(false)
  const [_loading, _setLoading] = useState(false)
  const [_error, _setError] = useState('')

  async function _handleEmailSignIn() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      _setError('Please enter a valid email address')
      return
    }
    _setLoading(true)
    _setError('')
    try {
      const result = await signIn('email', {
        email,
        callbackUrl: '/student/onboarding',
        redirect: false,
      })
      if (result?.error) {
        _setError('Could not send email. Please try again.')
      } else {
        setEmailSent(true)
      }
    } catch {
      _setError('Something went wrong. Please try again.')
    } finally {
      _setLoading(false)
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
          onClick={() => signIn('google', { callbackUrl: '/student/onboarding' })}
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
        {/* <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"/>
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"/>
        </div> */}

        {/* Email magic link */}
        {/* <div className="space-y-3">
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
        </div> */}

        {/* Trust line */}
        <p className="text-center text-xs text-gray-400">
          {FREE_SESSIONS_TEXT} · No credit card · Cancel anytime
        </p>
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
