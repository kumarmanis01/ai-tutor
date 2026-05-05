'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Logo from '@/components/Logo'
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier'

function AuthContent() {
  const searchParams = useSearchParams()
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
        callbackUrl: '/auth/role',
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
          <div className="w-16 h-16 bg-[#EEEDFE] rounded-full flex items-center justify-center mx-auto text-3xl">📧</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Check your email
          </h1>
          <p className="text-gray-500 text-sm">
            We sent a sign-in link to <strong>{email}</strong>.
            Click the link to continue.
          </p>
          <button
            onClick={() => setEmailSent(false)}
            className="text-sm text-[#534AB7] hover:underline"
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

        {/* Google Sign In */}
        <button
          onClick={() => signIn('google', { callbackUrl: '/student/onboarding' })}
          className="w-full flex items-center justify-center gap-3 px-4 py-3
                     border border-gray-300 dark:border-gray-600 rounded-xl
                     bg-white dark:bg-gray-900 hover:bg-gray-50
                     dark:hover:bg-gray-800 transition-colors
                     text-gray-700 dark:text-gray-200 font-medium text-sm"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 014.26 9c0-.53.09-1.04.25-1.52V5.41H1.83A8 8 0 001 9c0 1.29.31 2.51.83 3.59l2.68-2.07z"/>
            <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.51 7.48C5.14 5.6 6.9 3.58 8.98 3.58z"/>
          </svg>
          Continue with Google
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
                       focus:outline-none focus:ring-2 focus:ring-[#534AB7]
                       focus:border-transparent text-sm"
          />
          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}
          <button
            onClick={handleEmailSignIn}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#534AB7] hover:bg-[#4338A0]
                       text-white font-medium text-sm transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send sign-in link →'}
          </button>
        </div>

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
        <div className="w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin"/>
      </div>
    }>
      <AuthContent />
    </Suspense>
  )
}
