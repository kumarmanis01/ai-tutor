'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Stage = 'phone' | 'otp' | 'loading';

function SignupContent() {
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const paramPhone = searchParams.get('phone');
    const storedPhone = sessionStorage.getItem('spinzy_signup_phone');
    const pre = paramPhone || storedPhone;
    if (pre && /^[6-9]\d{9}$/.test(pre)) {
      setPhone(pre);
    }
  }, [searchParams]);

  const phoneDigits = phone.replace(/\D/g, '');

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\d{10}$/.test(phoneDigits)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    const ageNum = Number(age);
    if (!age || !Number.isInteger(ageNum) || ageNum < 8 || ageNum > 30) {
      setError('Enter your age (8–30).');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not send code. Try again.');
        return;
      }
      setStage('otp');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const code = otp.trim();
    if (!/^\d{4,6}$/.test(code)) {
      setError('Enter the 4–6 digit code we sent to your phone.');
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits, code }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Incorrect code. Try again.');
        return;
      }
      setStage('loading');
      sessionStorage.removeItem('spinzy_signup_phone');
      window.location.href = `/student/onboarding?age=${encodeURIComponent(age)}`;
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  if (stage === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-24 gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-[#534AB7]/20 border-t-[#534AB7] animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Setting up your account…</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-10">
      <div className="mx-auto w-full max-w-sm">

        {/* Logo mark */}
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#534AB7]">
            <span className="text-base font-bold leading-none text-white">S</span>
          </div>
          <span className="text-xl font-bold text-[#534AB7]">Spinzy</span>
        </div>

        {stage === 'otp' ? (
          <>
            <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              Enter the code
            </h1>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Sent to +91&nbsp;{phoneDigits}.
            </p>
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <label
                  htmlFor="otp-input"
                  className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Verification code
                </label>
                <input
                  id="otp-input"
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-[#534AB7] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-[#FCEBEB] px-3 py-2 text-sm text-[#E24B4A] dark:bg-[#E24B4A]/10">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={verifying}
                className="min-h-[44px] w-full rounded-lg bg-[#534AB7] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4239a3] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifying ? 'Verifying…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => { setStage('phone'); setError(''); setOtp(''); }}
                className="min-h-[44px] w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-900"
              >
                Change number
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              Welcome to Spinzy
            </h1>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Your AI tutor for CBSE &amp; ICSE, Grades 6–12.
            </p>

            {/* Google OAuth */}
            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: '/student/onboarding' })}
              className="mb-4 min-h-[44px] w-full flex items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-400">or use mobile number</span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* Phone + age form */}
            <form onSubmit={sendOtp} className="space-y-4">
              <div>
                <label
                  htmlFor="phone-input"
                  className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Mobile number
                </label>
                <div className="flex">
                  <span className="inline-flex min-h-[44px] items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    +91
                  </span>
                  <input
                    id="phone-input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit number"
                    className="min-h-[44px] flex-1 rounded-r-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-[#534AB7] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="age-input"
                  className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Your age
                </label>
                <input
                  id="age-input"
                  type="number"
                  inputMode="numeric"
                  min={8}
                  max={30}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 14"
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-[#534AB7] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                {age && Number(age) >= 8 && Number(age) < 13 && (
                  <p className="mt-1.5 text-xs text-[#BA7517]">
                    A parent&apos;s approval will be needed to activate your account.
                  </p>
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-[#FCEBEB] px-3 py-2 text-sm text-[#E24B4A] dark:bg-[#E24B4A]/10">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="min-h-[44px] w-full rounded-lg bg-[#534AB7] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4239a3] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Send OTP'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
              By continuing you agree to our{' '}
              <Link href="/terms" className="underline hover:text-gray-600 dark:hover:text-gray-300">
                Terms
              </Link>
              {' '}and{' '}
              <Link href="/privacy" className="underline hover:text-gray-600 dark:hover:text-gray-300">
                Privacy Policy
              </Link>.
            </p>

            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                className="font-medium text-[#534AB7] hover:underline"
              >
                Sign in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.235 17.64 11.927 17.64 9.2Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}
