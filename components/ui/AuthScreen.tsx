'use client'
import React, { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { GradIcon, ShieldIcon } from './Icons'

type AuthRole = 'student' | 'parent'

interface AuthScreenProps {
  role?: AuthRole
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="none" stroke="#4285F4" strokeWidth="3.2" strokeDasharray="13 37" transform="rotate(-45 10 10)" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="#EA4335" strokeWidth="3.2" strokeDasharray="13 37" transform="rotate(135 10 10)" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="#FBBC05" strokeWidth="3.2" strokeDasharray="13 37" transform="rotate(80 10 10)" />
      <circle cx="10" cy="10" r="8" fill="none" stroke="#34A853" strokeWidth="3.2" strokeDasharray="13 37" transform="rotate(195 10 10)" />
      <text x="10" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)" fontFamily="var(--font-sans)">G</text>
    </svg>
  )
}

export function AuthScreen({ role = 'student' }: AuthScreenProps) {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? (role === 'parent' ? '/parent/dashboard' : '/student/dashboard')

  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isParent = role === 'parent'
  const heading = isParent ? 'Sign in as parent' : 'Sign in to Spinzy'
  const sub = isParent
    ? "Follow your child's exam-prep journey."
    : "Let's set up your personalised study plan."

  const handleGoogle = async () => {
    setBusy(true)
    setErrorMsg(null)
    try {
      await signIn('google', { callbackUrl })
    } catch {
      setBusy(false)
      setErrorMsg('Could not sign you in. Please try again.')
    }
  }

  if (busy) {
    return (
      <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 32, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 99, border: '4px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spz-spin 0.8s linear infinite', marginBottom: 22 }} />
        <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>Signing you in...</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Securely verifying your account</div>
      </div>
    )
  }

  return (
    <div className="spz-root" style={{ minHeight: '100vh', overflow: 'auto', background: 'var(--bg)', display: 'flex', flexDirection: 'column', maxWidth: 390, margin: '0 auto' }}>
      <div style={{ flex: 1, padding: '24px 24px 16px', display: 'flex', flexDirection: 'column' }}>
        {/* brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 26 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--brand-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <GradIcon size={24} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>Spinzy</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{isParent ? 'Parent' : 'Student'}</div>
          </div>
        </div>

        <h1 style={{ margin: '0 0 6px', fontSize: 25, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text)' }}>{heading}</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>{sub}</p>

        {/* Google OAuth -- only sign-in method currently wired in NextAuth */}
        <button
          onClick={handleGoogle}
          disabled={busy}
          style={{ width: '100%', height: 52, borderRadius: 14, background: 'var(--surface)', border: '1.5px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600, color: 'var(--text)', minHeight: 44, opacity: busy ? 0.7 : 1 }}
        >
          <GoogleMark />{busy ? 'Signing in...' : 'Continue with Google'}
        </button>

        {errorMsg && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--tier-critical-soft)', color: 'var(--tier-critical)', fontSize: 13, fontWeight: 600 }}>
            {errorMsg}
          </div>
        )}
      </div>

      {/* footer */}
      <div style={{ padding: '12px 24px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-faint)' }}>
          <ShieldIcon size={13} />
          <span style={{ fontSize: 10.5, lineHeight: 1.4, textAlign: 'center' }}>
            By continuing you agree to our Terms & DPDP Privacy Policy.
          </span>
        </div>
      </div>
    </div>
  )
}
