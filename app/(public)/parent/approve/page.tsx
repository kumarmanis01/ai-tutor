/**
 * FILE OBJECTIVE:
 * - P1.3-R: Public parent consent mini-page. Validates a consent token from the
 *   query string, shows the child's details plus a DPDP checklist, and allows
 *   the parent to approve (via Google OAuth or 6-digit OTP) or deny the request.
 *   No login required to land on this page.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/parent/approve/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | staff-engineer | created per P1.3-R AC
 * - 2026-04-24T00:00:00Z | copilot | wrap ParentApproveInner in Suspense boundary to satisfy Next.js useSearchParams requirement
 */

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import OTPInput from '@/components/parent/OTPInput'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

type PageStatus =
  | 'loading'
  | 'invalid'
  | 'expired'
  | 'consent_form'
  | 'otp_input'
  | 'success'
  | 'denied'

interface ConsentData {
  child: { name: string; grade: string | null; board: string | null } | null
  channel: string
  expiresAt: string
}

const CONTROLS_ALLOWED = [
  'View progress reports and topics covered',
  'Set weekly session limits from your dashboard',
  'Receive weekly email summaries',
  'Withdraw consent at any time',
]

const CONTROLS_NOT = [
  'No social features -- no chat, no friend requests',
  'Data is never sold to advertisers',
]

// ── Component ──────────────────────────────────────────────────────────────────

function ParentApproveInner() {
  const params = useSearchParams()
  const token = params.get('token')
  const actionParam = params.get('action')
  const approvedParam = params.get('approved')
  const { data: session, status: sessionStatus } = useSession()

  const [pageStatus, setPageStatus] = useState<PageStatus>('loading')
  const [consentData, setConsentData] = useState<ConsentData | null>(null)
  const [otpSending, setOtpSending] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [denyConfirm, setDenyConfirm] = useState(false)
  const [denying, setDenying] = useState(false)

  // Validate the token on mount
  useEffect(() => {
    if (!token) {
      setPageStatus('invalid')
      return
    }

    async function validate() {
      const res = await fetch(`/api/v1/consent/status?consent_token=${encodeURIComponent(token!)}`)
      if (!res.ok) {
        setPageStatus('invalid')
        return
      }
      const data = (await res.json()) as {
        status?: string
        child?: { name: string; grade: string | null; board: string | null } | null
        channel?: string
        expiresAt?: string
      }
      if (data.status === 'expired') {
        setPageStatus('expired')
        return
      }
      if (data.status === 'approved') {
        setPageStatus('success')
        return
      }
      if (data.status === 'denied') {
        setPageStatus('denied')
        return
      }
      if (data.status === 'pending') {
        setConsentData({
          child: data.child ?? null,
          channel: data.channel ?? 'EMAIL',
          expiresAt: data.expiresAt ?? '',
        })
        // If deny action came from the direct deny link in email
        if (actionParam === 'deny') {
          setDenyConfirm(true)
        }
        setPageStatus('consent_form')
        return
      }
      setPageStatus('invalid')
    }

    validate().catch(() => setPageStatus('invalid'))
  }, [token, actionParam])

  // Auto-approve when Google OAuth redirects back with ?approved=1
  useEffect(() => {
    if (approvedParam !== '1' || sessionStatus !== 'authenticated' || !session || !token) return
    if (pageStatus === 'success') return

    async function autoApprove() {
      const res = await fetch('/api/v1/consent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, method: 'google' }),
      })
      if (res.ok) {
        setPageStatus('success')
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setApproveError(data?.error ?? 'Could not approve. Please try again.')
      }
    }

    autoApprove().catch(() => setApproveError('Could not approve. Please try again.'))
  }, [approvedParam, sessionStatus, session, token, pageStatus])

  async function handleGoogleApprove() {
    if (!token) return
    const callbackUrl = `${window.location.origin}/parent/approve?token=${encodeURIComponent(token)}&approved=1`
    await signIn('google', { callbackUrl })
  }

  async function handleSendOTP() {
    setOtpError(null)
    setOtpSending(true)
    const res = await fetch('/api/v1/consent/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    setOtpSending(false)
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      const msg =
        data?.error === 'cooldown'
          ? 'Please wait a few minutes before requesting another code.'
          : 'Could not send code. Please try again.'
      setOtpError(msg)
      return
    }
    setPageStatus('otp_input')
  }

  async function handleOTPComplete(code: string) {
    setApproveError(null)
    const res = await fetch('/api/v1/consent/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, method: 'otp', otp_code: code }),
    })
    if (res.ok) {
      setPageStatus('success')
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setApproveError(data?.error === 'max_attempts_exceeded'
        ? 'Too many incorrect attempts. Please request a new code.'
        : 'Incorrect code. Please try again.')
    }
  }

  async function handleDeny() {
    setDenying(true)
    const res = await fetch('/api/v1/consent/deny', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    setDenying(false)
    if (res.ok) {
      setPageStatus('denied')
    }
  }

  const childName = consentData?.child?.name ?? 'your child'
  const childGrade = consentData?.child?.grade ? `Grade ${consentData.child.grade}` : ''
  const childBoard = consentData?.child?.board ?? ''

  // ── Render states ──────────────────────────────────────────────────────────

  if (pageStatus === 'loading') {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
        </div>
      </PageWrapper>
    )
  }

  if (pageStatus === 'invalid') {
    return (
      <PageWrapper>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Invalid link</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          This approval link is invalid or has already been used. Contact us if you need help.
        </p>
        <a href="mailto:hello@spinzyacademy.com" className="mt-4 block text-[#534AB7] text-sm underline">
          hello@spinzyacademy.com
        </a>
      </PageWrapper>
    )
  }

  if (pageStatus === 'expired') {
    return (
      <PageWrapper>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Link expired</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          This approval link has expired (links are valid for 48 hours). Your child can request a
          new one from the Spinzy sign-up page.
        </p>
      </PageWrapper>
    )
  }

  if (pageStatus === 'success') {
    return (
      <PageWrapper>
        <div className="text-5xl text-center mb-4" aria-hidden="true">&#x2705;</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center">
          {childName}&apos;s account is now active!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
          Vidya, your child&apos;s AI tutor, is ready to help them study. You&apos;ll receive a
          weekly progress report every Sunday.
        </p>
        <Link
          href="/parent/dashboard"
          className="mt-6 block w-full bg-[#534AB7] text-white text-center font-bold
            rounded-2xl py-4 min-h-[52px] hover:bg-[#4239a0] transition-colors"
        >
          Go to Parent Dashboard
        </Link>
      </PageWrapper>
    )
  }

  if (pageStatus === 'denied') {
    return (
      <PageWrapper>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Access denied</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          You have denied access for {childName}. If this was a mistake, contact us and we will
          send a new approval link.
        </p>
        <a href="mailto:hello@spinzyacademy.com" className="mt-4 block text-[#534AB7] text-sm underline">
          hello@spinzyacademy.com
        </a>
      </PageWrapper>
    )
  }

  if (pageStatus === 'otp_input') {
    return (
      <PageWrapper>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Enter verification code
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          We sent a 6-digit code to {consentData?.channel === 'WHATSAPP' ? 'WhatsApp' : 'your email'}.
          Enter it below to approve {childName}&apos;s account.
        </p>

        <OTPInput onComplete={handleOTPComplete} disabled={false} />

        {approveError && (
          <p role="alert" className="mt-4 text-sm text-[#E24B4A] bg-[#FCEBEB] rounded-lg px-4 py-3 text-center">
            {approveError}
          </p>
        )}

        <button
          type="button"
          onClick={() => setPageStatus('consent_form')}
          className="mt-6 w-full text-[#534AB7] text-sm font-medium py-3 min-h-[44px] hover:underline"
        >
          &larr; Go back
        </button>
      </PageWrapper>
    )
  }

  // consent_form (default)
  return (
    <PageWrapper>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        {childName} wants to learn with Spinzy
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {[childGrade, childBoard].filter(Boolean).join(' -- ')}
      </p>

      {/* Controls summary */}
      <div className="mt-5 bg-[#EEEDFE] rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">
          As a parent you can:
        </p>
        <ul className="space-y-2">
          {CONTROLS_ALLOWED.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span aria-hidden="true" className="text-[#1D9E75]">&#x2705;</span>
              {item}
            </li>
          ))}
          {CONTROLS_NOT.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span aria-hidden="true" className="text-[#E24B4A]">&#x274C;</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {approveError && (
        <p role="alert" className="mt-4 text-sm text-[#E24B4A] bg-[#FCEBEB] rounded-lg px-4 py-3">
          {approveError}
        </p>
      )}

      {/* Deny confirm dialog */}
      {denyConfirm && (
        <div className="mt-4 bg-[#FCEBEB] rounded-2xl p-4 text-center">
          <p className="text-sm font-semibold text-gray-800 dark:text-white mb-3">
            Are you sure you want to deny {childName}&apos;s account?
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              disabled={denying}
              onClick={handleDeny}
              className="bg-[#E24B4A] text-white text-sm font-bold rounded-xl px-5 py-3 min-h-[44px]
                hover:bg-[#c03a39] disabled:opacity-60"
            >
              {denying ? 'Denying...' : 'Yes, deny'}
            </button>
            <button
              type="button"
              onClick={() => setDenyConfirm(false)}
              className="border border-gray-300 text-gray-700 dark:text-white text-sm font-medium
                rounded-xl px-5 py-3 min-h-[44px] hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!denyConfirm && (
        <div className="mt-6 space-y-3">
          {/* Google approval */}
          <button
            type="button"
            onClick={handleGoogleApprove}
            className="w-full flex items-center justify-center gap-3 bg-[#534AB7] text-white
              font-bold rounded-2xl py-4 min-h-[52px] hover:bg-[#4239a0] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#fff"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#d1d5f9"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#d1d5f9"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#d1d5f9"
              />
            </svg>
            Approve with Google
          </button>

          {/* OTP approval */}
          <button
            type="button"
            onClick={handleSendOTP}
            disabled={otpSending}
            className="w-full border-2 border-[#534AB7] text-[#534AB7] font-bold rounded-2xl
              py-4 min-h-[52px] hover:bg-[#EEEDFE] transition-colors disabled:opacity-60"
          >
            {otpSending ? 'Sending code...' : `Approve with ${consentData?.channel === 'WHATSAPP' ? 'WhatsApp' : 'Email'} Code`}
          </button>

          {otpError && (
            <p role="alert" className="text-sm text-[#E24B4A] text-center">{otpError}</p>
          )}

          {/* Deny link */}
          <button
            type="button"
            onClick={() => setDenyConfirm(true)}
            className="w-full text-gray-400 text-sm py-3 min-h-[44px] hover:text-[#E24B4A]
              transition-colors"
          >
            Deny Access
          </button>
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400 text-center">
        Spinzy Academy complies with India&apos;s DPDP Act 2023.{' '}
        <Link href="/privacy" className="underline hover:text-[#534AB7]">
          Privacy Policy
        </Link>
      </p>
    </PageWrapper>
  )
}

// ── Page export (Suspense boundary required for useSearchParams) ───────────────

export default function ParentApprovePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ParentApproveInner />
    </Suspense>
  )
}

// ── Layout wrapper ─────────────────────────────────────────────────────────────

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-start sm:items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          {/* Inline logo text instead of next/image to avoid requiring a public asset */}
          <span className="text-[#534AB7] font-extrabold text-xl tracking-tight">Spinzy</span>
          <span className="text-gray-400 text-sm">Academy</span>
        </div>
        {children}
      </div>
    </div>
  )
}
