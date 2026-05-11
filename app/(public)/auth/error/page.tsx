/**
 * FILE OBJECTIVE:
 * - Render a branded auth error page for NextAuth callback failures, with human-readable
 *   messages per error code and a safe "Try again" / "Go back" retry flow.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/public/auth/error/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | create branded auth error page with per-code messages and open-redirect guard
 */
'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Logo from '@/components/Logo'

const FALLBACK_RETURN = '/auth/signup'

function sanitizeReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return FALLBACK_RETURN
  }
  return raw
}

const ERROR_MESSAGES: Record<string, string> = {
  Callback: "Google sign-in could not be completed. This sometimes happens when the sign-in window is left open too long or cookies are blocked.",
  OAuthCallback: "There was a problem communicating with Google. Please try again.",
  OAuthSignin: "Could not start the Google sign-in process. Please try again.",
  OAuthAccountNotLinked: "This email is already registered with a different sign-in method. Please use the method you signed up with.",
  SessionRequired: "Please sign in to continue.",
  Default: "Something went wrong during sign-in. Please try again.",
}

function ErrorContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const errorCode = searchParams.get('error') ?? 'Default'
  const message = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES['Default']
  const returnTo = sanitizeReturnTo(searchParams.get('callbackUrl'))

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <Logo variant="auth" className="mb-6" />
        </div>

        <div className="w-14 h-14 rounded-full bg-[#FCEBEB] flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-[#E24B4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Sign-in failed</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{message}</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/auth/signup')}
            className="w-full py-3 rounded-xl bg-[#534AB7] hover:bg-[#4338A0]
                       text-white font-medium text-sm transition-colors
                       min-h-[44px]"
          >
            Try again
          </button>
          <button
            onClick={() => router.push(returnTo)}
            className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-600
                       text-gray-600 dark:text-gray-300 font-medium text-sm
                       hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                       min-h-[44px]"
          >
            Go back
          </button>
        </div>

        <p className="text-xs text-gray-400">
          If this keeps happening, try clearing your browser cookies and signing in again.
        </p>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin"/>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
