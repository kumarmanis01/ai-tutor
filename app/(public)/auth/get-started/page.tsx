/**
 * FILE OBJECTIVE:
 * - Role-first signup entry. Unauthenticated visitors pick a role before authenticating.
 *   Clicking a tile starts Google sign-in with the right callbackUrl so role is set
 *   before the callback, not after. /auth/role remains as a safety-net fallback.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/public/auth/get-started/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | claude | create role-first signup page: two RoleTiles,
 *     inviteCode fast-path, parent highlight via ?source=parent,
 *     OAuth error banner, authenticated redirect
 */
'use client'

import { Suspense, useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { Spinner } from '@/components/UI/design-system'
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier'

const STUDENT_ONBOARDING = '/student/onboarding'
const PARENT_ONBOARDING = '/parent/onboarding'
const GOOGLE_ERROR_CODES = new Set(['Callback', 'OAuthCallback', 'OAuthSignin', 'OAuthAccountNotLinked'])

function buildParentCallback(inviteCode: string): string {
  if (!inviteCode) return PARENT_ONBOARDING
  return `${PARENT_ONBOARDING}?inviteCode=${encodeURIComponent(inviteCode)}`
}

interface RoleTileProps {
  role: 'student' | 'parent'
  title: string
  description: string
  bullets: string[]
  glyph: string
  accent: 'primary' | 'success'
  recommended?: boolean
  onClick: () => void
  loading: boolean
}

function RoleTile({ role, title, description, bullets, glyph, accent, recommended, onClick, loading }: RoleTileProps) {
  const bg = accent === 'primary' ? 'bg-primary-bg' : 'bg-success-bg'
  const border = accent === 'primary' ? 'border-primary' : 'border-success'
  const text = accent === 'primary' ? 'text-primary' : 'text-success'
  const checkColor = 'text-success'

  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label={`${title} -- sign up as ${role}`}
      className={[
        'w-full text-left p-5 rounded-2xl border-2 transition-all duration-200',
        'min-h-[44px] flex items-start gap-4',
        'hover:-translate-y-px hover:shadow-md',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        bg, border,
      ].join(' ')}
    >
      <span className={`shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl ${text} bg-card text-2xl`}>
        {glyph}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className={`block font-bold text-lg ${text}`}>{title}</span>
          {recommended && (
            <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-success-bg text-success border border-success">
              Recommended
            </span>
          )}
        </span>
        <span className="block text-sm text-muted-foreground mt-1">{description}</span>
        <ul className="mt-3 space-y-1">
          {bullets.map(b => (
            <li key={b} className={`text-xs text-foreground/70 flex items-start gap-1.5`}>
              <svg className={`w-3.5 h-3.5 mt-0.5 ${checkColor} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </span>
      <svg className={`w-5 h-5 ${text} shrink-0 mt-2`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  )
}

function GetStartedContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = String(searchParams.get('inviteCode') ?? '').trim().toUpperCase().slice(0, 16)
  const source = searchParams.get('source') ?? ''
  const highlightParent = source === 'parent'
  const authError = searchParams.get('error') ?? ''
  const googleFailed = GOOGLE_ERROR_CODES.has(authError)

  const [loading, setLoading] = useState<'student' | 'parent' | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && session) {
      const user = session.user as {
        role?: string
        accountStatus?: string
        onboardingComplete?: boolean
      }
      const role = user?.role ?? ''
      const accountStatus = user?.accountStatus ?? ''
      const onboardingComplete = user?.onboardingComplete ?? false

      if (role === 'student') {
        // Existing active students go straight to dashboard; only new/incomplete go to onboarding
        if (accountStatus === 'active' && onboardingComplete) {
          router.replace('/student/dashboard')
        } else {
          router.replace(STUDENT_ONBOARDING)
        }
      } else if (role === 'parent') {
        router.replace(PARENT_ONBOARDING)
      } else {
        // No role set yet -- set-role page handles this
        router.replace('/auth/role')
      }
    }
  }, [status, session, router])

  // Gate to unauthenticated only: avoids re-triggering signIn on top of an
  // existing session (which causes OAuthAccountNotLinked / redirect loops).
  useEffect(() => {
    if (inviteCode && status === 'unauthenticated') {
      setLoading('parent')
      const callbackUrl = buildParentCallback(inviteCode)
      signIn('google', { callbackUrl }).catch(() => setLoading(null))
    }
  }, [inviteCode, status])

  async function handleRoleSelect(role: 'student' | 'parent') {
    setLoading(role)
    // Send to the dashboard after OAuth. The middleware accountStatus guard
    // will redirect new/incomplete students to /student/onboarding if needed.
    // This prevents existing active users from being dumped into onboarding.
    const callbackUrl = role === 'parent' ? PARENT_ONBOARDING : '/student/dashboard'
    try {
      await signIn('google', { callbackUrl })
    } catch {
      setLoading(null)
    }
  }

  if (status === 'loading' || (inviteCode && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo variant="auth" className="mb-4" />
          </div>
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Welcome</p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {"Who's learning today?"}
          </h1>
          <p className="text-base text-muted-foreground">
            {"We'll set things up just for you."}
          </p>
        </div>

        {/* OAuth error banner (e.g. NextAuth appends ?error= on callback failures) */}
        {googleFailed && (
          <div className="rounded-xl bg-error-bg border border-brand-danger/20 px-4 py-3 text-sm text-error">
            Google sign-in did not complete. Please try again -- if the problem continues, clear your browser cookies.
          </div>
        )}

        {/* Role tiles */}
        <div className="space-y-3">
          <RoleTile
            role="student"
            title="I'm a student"
            description="Get instant help with homework and doubts."
            bullets={[
              `Adaptive practice across CBSE / ICSE / State`,
              `Hindi or English, 24x7`,
              FREE_SESSIONS_TEXT,
            ]}
            glyph="🎒"
            accent="primary"
            onClick={() => handleRoleSelect('student')}
            loading={loading !== null}
          />
          <RoleTile
            role="parent"
            title="I'm a parent"
            description="Set up an account for your child and see their progress."
            bullets={[
              `Weekly progress digest by email`,
              `Set daily study targets`,
              `Monitor multiple children`,
            ]}
            glyph="👨‍👩‍👧"
            accent="success"
            recommended={highlightParent}
            onClick={() => handleRoleSelect('parent')}
            loading={loading !== null}
          />
        </div>

        {/* Loading indicator when a tile was picked */}
        {loading && (
          <div className="flex justify-center">
            <Spinner size="sm" />
          </div>
        )}

        {/* Already have an account */}
        <div className="text-center">
          <Link
            href="/login/student"
            className="inline-block text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Already have an account?{' '}
            <span className="font-medium text-primary underline-offset-2 hover:underline">
              Log in
            </span>
          </Link>
        </div>

        {/* Trust line */}
        <p className="text-center text-xs text-gray-400">
          {FREE_SESSIONS_TEXT} · No credit card · Cancel anytime
        </p>
      </div>
    </div>
  )
}

export default function GetStartedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    }>
      <GetStartedContent />
    </Suspense>
  )
}
