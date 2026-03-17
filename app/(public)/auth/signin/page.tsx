'use client';

/**
 * Registration / Sign-in — v2
 *
 * Screen 1 of the v2 onboarding wireframe.
 *
 * States:
 *   phone  → enter mobile number + age, "Send OTP" or "Continue with Google"
 *   otp    → enter 6-digit code, "Verify"
 *   loading → spinner while verifying / redirecting
 *
 * After phone OTP success: redirect to /student/onboarding?age=<age>
 * Google OAuth: signIn('google', { callbackUrl: /student/onboarding })
 *
 * Mobile-first: full-height on mobile, max-w-sm card on desktop.
 */

import React, { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

type Stage = 'phone' | 'otp' | 'loading';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const paramPhone = searchParams.get('phone');
    const storedPhone = sessionStorage.getItem('spinzy_signup_phone');
    const pre = paramPhone || storedPhone;
    if (pre && /^[6-9]\d{9}$/.test(pre)) {
      setPhone(pre);
    }
  }, [searchParams]);

  // ── Send OTP ───────────────────────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const digits = phone.replace(/\D/g, '');
    if (!/^\d{10}$/.test(digits)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    const ageNum = Number(age);
    if (!age || !Number.isInteger(ageNum) || ageNum < 8 || ageNum > 30) {
      setError('Enter your age (8–30).');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error ?? 'Could not send OTP. Please try again.');
        return;
      }
      setStage('otp');
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setBusy(false);
    }
  }

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!/^\d{4,6}$/.test(otp.trim())) {
      setError('Enter the 4–6 digit code we sent.');
      return;
    }

    setBusy(true);
    setStage('loading');
    try {
      const digits = phone.replace(/\D/g, '');
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, code: otp.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error ?? 'Incorrect code. Please try again.');
        setStage('otp');
        return;
      }
      // Session cookie is set by the API. Redirect to onboarding with age.
      sessionStorage.removeItem('spinzy_signup_phone');
      router.push(`/student/onboarding?age=${encodeURIComponent(age)}`);
    } catch {
      setError('Network error. Please check your connection.');
      setStage('otp');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#534AB7] flex items-center justify-center mb-4 shadow-lg shadow-[#534AB7]/30">
            <span className="text-white font-bold text-2xl leading-none">S</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome to Spinzy</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">AI home tutor · CBSE Grades 6–12</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="p-6">

            {/* Google button */}
            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: '/student/onboarding' })}
              className="flex w-full min-h-[44px] items-center justify-center gap-3 rounded-xl border-2 border-[#534AB7] bg-white dark:bg-slate-800 text-[#534AB7] dark:text-indigo-300 text-sm font-semibold hover:bg-[#534AB7]/5 dark:hover:bg-[#534AB7]/10 transition-colors"
            >
              {/* Google G icon */}
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
              <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
            </div>

            {/* ── Phone stage ──────────────────────────────────────────── */}
            {(stage === 'phone' || stage === 'loading') && (
              <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Mobile number
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setError(''); }}
                    placeholder="10-digit mobile number"
                    autoComplete="tel"
                    className="w-full min-h-[44px] px-4 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="reg-age" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Age
                  </label>
                  <input
                    id="reg-age"
                    type="tel"
                    inputMode="numeric"
                    value={age}
                    onChange={(e) => { setAge(e.target.value); setError(''); }}
                    placeholder="e.g. 15"
                    className="w-full min-h-[44px] px-4 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-[#E24B4A] dark:text-red-400">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-60 transition-all shadow-md shadow-[#534AB7]/25"
                >
                  {busy ? 'Sending…' : 'Send OTP'}
                </button>
              </form>
            )}

            {/* ── OTP stage ────────────────────────────────────────────── */}
            {stage === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  We sent a code to <span className="font-semibold">{phone}</span>.{' '}
                  <button type="button" onClick={() => { setStage('phone'); setOtp(''); setError(''); }} className="text-[#534AB7] dark:text-indigo-400 hover:underline text-sm">
                    Change number
                  </button>
                </p>

                <div>
                  <label htmlFor="reg-otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Verification code
                  </label>
                  <input
                    id="reg-otp"
                    type="tel"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value); setError(''); }}
                    placeholder="Enter OTP"
                    autoFocus
                    maxLength={6}
                    className="w-full min-h-[44px] px-4 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7] focus:border-transparent tracking-widest text-center text-lg font-mono"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-[#E24B4A] dark:text-red-400">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-60 transition-all shadow-md shadow-[#534AB7]/25"
                >
                  {busy ? 'Verifying…' : 'Verify & continue'}
                </button>
              </form>
            )}

            {/* Loading overlay */}
            {stage === 'loading' && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Setting up your account…
              </div>
            )}
          </div>

          {/* Terms */}
          <div className="px-6 pb-6 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
              By continuing you agree to our{' '}
              <Link href="/terms" className="text-gray-600 dark:text-gray-400 underline hover:text-[#534AB7]">Terms</Link>
              {' '}&amp;{' '}
              <Link href="/privacy" className="text-gray-600 dark:text-gray-400 underline hover:text-[#534AB7]">Privacy Policy</Link>
            </p>
          </div>
        </div>

        {/* Already have an account? */}
        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link href="/api/auth/signin" className="text-[#534AB7] dark:text-indigo-400 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
