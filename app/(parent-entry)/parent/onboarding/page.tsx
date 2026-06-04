/**
 * FILE OBJECTIVE:
 * - Finalize parent onboarding by enforcing parent role for authenticated users and forwarding invite codes into the parent linking flow.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/parent/onboarding/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add parent onboarding route that auto-assigns parent role and redirects to link flow
 */
'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { logger } from '@/lib/logger'
import Logo from '@/components/Logo'

// TODO [FEATURE]: Two-way child onboarding
// Currently parents can only link an existing student (by email or 8-digit code).
// Planned: parent enters child email -> platform sends magic onboarding link to child
// OR parent creates a managed child profile directly (required for under-13 per COPPA).
// Ticket: [create and reference ticket here]

const CLASS_NAME = 'ParentOnboardingPage'
const PARENT_ROLE = 'parent'
const SIGN_IN_ROUTE = '/auth/login'
const PARENT_LINK_ROUTE = '/parent/dashboard'
const PARENT_ONBOARDING_ROUTE = '/parent/onboarding'

function buildOnboardingPathWithInvite(inviteCode: string): string {
  if (!inviteCode) {
    return PARENT_ONBOARDING_ROUTE
  }

  return `${PARENT_ONBOARDING_ROUTE}?inviteCode=${encodeURIComponent(inviteCode)}`
}

function buildParentSignInRoute(inviteCode: string): string {
  const callbackUrl = buildOnboardingPathWithInvite(inviteCode)
  return `${SIGN_IN_ROUTE}?role=parent&callbackUrl=${encodeURIComponent(callbackUrl)}${inviteCode ? `&inviteCode=${encodeURIComponent(inviteCode)}` : ''}`
}

function buildParentLinkRoute(inviteCode: string): string {
  if (!inviteCode) {
    return PARENT_LINK_ROUTE
  }

  return `${PARENT_LINK_ROUTE}?mode=code&inviteCode=${encodeURIComponent(inviteCode)}`
}

function ParentOnboardingContent() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasStartedRef = useRef(false)
  const [error, setError] = useState('')

  const inviteCode = useMemo(() => {
    return String(searchParams.get('inviteCode') ?? '').trim().toUpperCase().slice(0, 16)
  }, [searchParams])

  useEffect(() => {
    if (hasStartedRef.current) {
      return
    }

    if (status === 'loading') {
      return
    }

    if (status === 'unauthenticated') {
      hasStartedRef.current = true
      router.replace(buildParentSignInRoute(inviteCode))
      return
    }

    if (status !== 'authenticated') {
      return
    }

    const currentRole = String((session?.user as { role?: string } | undefined)?.role ?? '').toLowerCase()
    if (currentRole === PARENT_ROLE) {
      hasStartedRef.current = true
      router.replace(buildParentLinkRoute(inviteCode))
      return
    }

    hasStartedRef.current = true
    void (async () => {
      try {
        const res = await fetch('/api/auth/set-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: PARENT_ROLE }),
        })

        if (!res.ok) {
          setError('Could not prepare parent access. Please retry in a moment.')
          hasStartedRef.current = false
          logger.error('Parent onboarding role assignment failed', {
            className: CLASS_NAME,
            status: res.status,
          })
          return
        }

        // Force a client-side session refresh so NextAuth repopulates the JWT Redis
        // cache with role=parent before we navigate. Capped at 6 s so a slow Neon
        // response cannot pin the spinner forever. proxy.ts now also allows
        // role=parent users through /parent regardless of accountStatus, so
        // navigation proceeds even if this call races or times out.
        try {
          await Promise.race([
            updateSession(),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('updateSession timeout')), 6000)
            ),
          ])
        } catch (sessionErr) {
          logger.warn('Parent onboarding: session refresh did not complete before navigation', {
            className: CLASS_NAME,
            userId: (session?.user as { id?: string } | undefined)?.id ?? 'unknown',
            timestamp: new Date().toISOString(),
            error: String(sessionErr),
          })
        }

        router.replace(buildParentLinkRoute(inviteCode))
      } catch (err) {
        setError('Could not prepare parent access. Please retry in a moment.')
        hasStartedRef.current = false
        logger.error('Parent onboarding role assignment request failed', {
          className: CLASS_NAME,
          error: String(err),
        })
      }
    })()
  }, [inviteCode, router, session, status])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-center space-y-4 shadow-sm">
        <div className="flex justify-center">
          <Logo variant="auth" />
        </div>
        <div className="w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin mx-auto" />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Setting up parent access</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          We are preparing your parent account and taking you to child linking.
        </p>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
    </div>
  )
}

export default function ParentOnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ParentOnboardingContent />
    </Suspense>
  )
}
