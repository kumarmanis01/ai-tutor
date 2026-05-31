/**
 * FILE OBJECTIVE:
 * - Render the manual parent verification form using canonical parent OTP API endpoints.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/student/onboarding/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | switch to /api/auth/parent send/verify OTP endpoints
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SpinnerLoader } from '@/components/UI/loaders';

export default function VerifyParentForm({
  maskedEmail,
}: {
  maskedEmail: string;
}) {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  async function handleSendOtp() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/auth/parent/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'email' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to send OTP');
        return;
      }
      setSendSuccess(true);
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter a 6-digit OTP');
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch('/api/auth/parent/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otp.trim(), channel: 'email' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.verified) {
        router.replace('/student/dashboard');
        return;
      }
      if (res.status === 423) {
        setError(data.error ?? 'Too many attempts. Try again in an hour.');
        return;
      }
      setError(
        data.error ??
          (data.attemptsRemaining !== undefined
            ? `Wrong OTP. ${data.attemptsRemaining} attempts remaining.`
            : 'Verification failed'),
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        We&apos;ll send a one-time code to your parent&apos;s email:
      </p>
      <p className="font-medium text-gray-900">{maskedEmail}</p>

      <div>
        <button
          type="button"
          onClick={handleSendOtp}
          disabled={sending}
          className="min-h-[44px] rounded-md bg-primary px-4 py-2 text-white disabled:opacity-60"
        >
          <span className="flex items-center gap-2">
            {sending && <SpinnerLoader size="small" color="#ffffff" />}
            {sending ? 'Sending...' : 'Send OTP'}
          </span>
        </button>
        {sendSuccess && (
          <p className="mt-2 text-sm text-green-600">
            OTP sent. Check your parent&apos;s email (or console in dev).
          </p>
        )}
      </div>

      <form onSubmit={handleConfirm} className="space-y-3">
        <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
          Enter 6-digit OTP
        </label>
        <input
          id="otp"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          className="w-32 rounded border border-gray-300 px-3 py-2 text-center text-lg tracking-widest"
        />
        <button
          type="submit"
          disabled={confirming || otp.length !== 6}
          className="min-h-[44px] rounded-md bg-primary px-4 py-2 text-white disabled:opacity-60"
        >
          <span className="flex items-center gap-2">
            {confirming && <SpinnerLoader size="small" color="#ffffff" />}
            {confirming ? 'Verifying...' : 'Verify'}
          </span>
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
