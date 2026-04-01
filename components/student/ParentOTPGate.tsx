'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ParentOTPGateProps {
  maskedEmail: string;
}

export default function ParentOTPGate({ maskedEmail }: ParentOTPGateProps) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null));
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const otp = digits.join('');
  const MAX_ATTEMPTS = 3;

  function startResendCooldown() {
    setResendCooldown(30);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleSendCode() {
    if (attempts >= MAX_ATTEMPTS) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/student/verify-parent/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.sent) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Could not send code');
      }
      setCodeSent(true);
      setAttempts((a) => a + 1);
      startResendCooldown();
      // Focus first box
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (e) {
      setError((e as Error).message || 'Could not send code. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/student/verify-parent/confirm-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
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

  function handleDigitChange(idx: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter' && otp.length === 6) {
      void handleVerify();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEEDFE] text-[#534AB7]">
            <span className="text-lg">🔒</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">One more step</h1>
        </div>

        <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
          To keep your account safe, a parent or guardian needs to verify your account.
        </p>
        <p className="mb-5 text-sm text-gray-700 dark:text-gray-300">
          A 6-digit code will be sent to:
          <br />
          <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{maskedEmail}</span>
        </p>

        {/* Send / Resend button */}
        <button
          type="button"
          onClick={handleSendCode}
          disabled={sending || resendCooldown > 0 || attempts >= MAX_ATTEMPTS}
          className="mb-5 w-full min-h-[44px] rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending
            ? 'Sending...'
            : resendCooldown > 0
            ? `Resend in ${resendCooldown}s`
            : codeSent
            ? 'Resend code'
            : 'Send OTP to parent'}
        </button>

        {codeSent && (
          <>
            {/* 6 individual digit boxes */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 text-center">
              Enter 6-digit code
            </p>
            <div className="mb-4 flex items-center justify-center gap-2" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  aria-label={`Digit ${i + 1} of 6`}
                  className="h-12 w-10 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-center text-xl font-bold text-gray-900 dark:text-gray-100 focus:border-[#534AB7] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30 transition-colors"
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying || otp.length !== 6}
              className="w-full min-h-[44px] rounded-xl bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </button>
          </>
        )}

        {error && <p className="mt-3 text-xs text-[#E24B4A]">{error}</p>}

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          {attempts < MAX_ATTEMPTS
            ? `${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining`
            : 'Max attempts reached.'}{' '}
          Having trouble? Contact support.
        </p>
      </div>
    </div>
  );
}
