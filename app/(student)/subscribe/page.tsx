/**
 * Student Subscription Page -- /subscribe
 *
 * F-STU-041: Student or parent subscribes to a paid plan via Indian payment methods.
 * AC-01: Monthly / Quarterly / Annual plans with GST breakdown shown in INR.
 * AC-02: UPI, Debit/Credit card, Net banking, EMI.
 * AC-03: Payment confirmation screen before charge.
 * AC-04: Instant access unlock on success + receipt.
 * AC-05: Failed payment 3-retry flow.
 * AC-06: Cancel any time, access to end of paid period.
 *
 * This page is the canonical entry point for subscription purchase and is also
 * reachable from:
 *   - SessionCompletionScreen upgrade CTA
 *   - FreemiumCounter "Upgrade" link
 *   - UpgradeBanner (shown when cap is hit on dashboard)
 *
 * EDIT LOG:
 *   2026-04-14 | gap-fix P1 | created; was previously missing -- F-STU-041
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireActiveSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UpgradeFlow } from '@/components/student/subscription/UpgradeFlow'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Subscribe | Spinzy AI Tutor',
  description: 'Unlock unlimited AI tutoring sessions with Spinzy',
}

export default async function SubscribePage() {
  const authSession = await requireActiveSession()
  if (!authSession) redirect('/')

  const userId = (authSession.user as { id: string }).id
  const currentPeriodStart = new Date()
  currentPeriodStart.setDate(1)
  currentPeriodStart.setHours(0, 0, 0, 0)
  
  const [user, freeTierUsage] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        subscriptionStatus: true,
      },
    }),
    prisma.freeTierUsage.findFirst({
      where: { studentId: userId, subjectScope: '__ALL__', periodStart: currentPeriodStart },
      select: { sessionsUsed: true, periodStart: true },
    }),
  ])

  if (!user) redirect('/')

  // If already premium, redirect to dashboard -- no need to subscribe again
  if (user.subscriptionStatus === 'premium') {
    redirect('/dashboard')
  }

  const sessionsUsed = freeTierUsage?.sessionsUsed ?? 0
  const sessionsRemaining = Math.max(0, 3 - sessionsUsed)
  const periodStart = freeTierUsage?.periodStart?.toISOString() ?? new Date(Date.now() - 15 * 86400000).toISOString()

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Back navigation */}
        <Link
          href="/dashboard"
          className="inline-flex items-center min-h-[44px] text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
        >
          <svg className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to dashboard
        </Link>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#534AB7] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#534AB7]/30">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">
            Unlock unlimited learning
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Keep learning with Teacher Vidya -- no session limits, fully personalised.
          </p>
        </div>

        {/* Benefit pills */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {[
            { icon: '🎯', text: 'Unlimited AI sessions' },
            { icon: '📊', text: 'Full progress reports' },
            { icon: '🧠', text: 'Adaptive learning path' },
            { icon: '📝', text: 'Chapter tests & mocks' },
          ].map((b) => (
            <div
              key={b.text}
              className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2.5"
            >
              <span className="text-base leading-none" aria-hidden>{b.icon}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{b.text}</span>
            </div>
          ))}
        </div>

        {/* UpgradeFlow handles all payment steps */}
        <UpgradeFlow
          studentName={user.name}
          studentEmail={user.email}
          freeTierUsage={{ sessionsUsed, sessionsRemaining, periodStart }}
        />

        {/* GST & terms note */}
        <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
          All prices inclusive of 18% GST. Cancel anytime -- access continues to end of paid period.
        </p>
      </div>
    </main>
  )
}