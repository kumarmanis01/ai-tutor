'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ParentOTPGateProps {
  maskedEmail: string;
}

export default function ParentOTPGate({ maskedEmail }: ParentOTPGateProps) {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleSendCode() {
    setSending(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/student/verify-parent/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.sent) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Could not send code');
      }
      setStatusMessage(`Code sent. Please check your parent or guardian email.`);
    } catch (e) {
      setError((e as Error).message || 'Could not send code. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (!otp.trim()) {
      setError('Please enter the 6-digit code.');
      return;
    }
    setVerifying(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/student/verify-parent/confirm-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.verified) {
        const msg = typeof json?.error === 'string' ? json.error : 'Invalid code. Please try again.';
        throw new Error(msg);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message || 'Could not verify code. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <span className="text-lg">🔒</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">One more step</h1>
        </div>

        <p className="mb-3 text-sm text-gray-700">
          To keep your account safe, a parent or guardian needs to verify your account.
        </p>
        <p className="mb-4 text-sm text-gray-700">
          We&apos;ll send a 6-digit code to:
          <br />
          <span className="font-mono font-semibold text-gray-900">{maskedEmail}</span>
        </p>

        <button
          type="button"
          onClick={handleSendCode}
          disabled={sending}
          className="mb-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {sending ? 'Sending...' : 'Send Code'}
        </button>

        <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
          ── Already have a code? ──
        </div>

        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.4em]"
            placeholder="••••••"
            aria-label="Enter 6-digit code"
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || otp.length !== 6}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {verifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>

        {statusMessage && <p className="mb-2 text-xs text-emerald-700">{statusMessage}</p>}
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

        <p className="mt-4 text-xs text-gray-500">
          Having trouble? Ask your parent or guardian to contact support from their email.
        </p>
      </div>
    </div>
  );
}

