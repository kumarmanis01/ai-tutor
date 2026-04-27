/**
 * FILE OBJECTIVE:
 * - Admin invite acceptance page with password setup, MFA enrollment, and backup-code confirmation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/setup/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:14:00Z | copilot | created A0.2 setup wizard page with 3 steps and complete flow
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PasswordStrengthMeter from '@/components/admin/auth/PasswordStrengthMeter';
import MFAEnrollment from '@/components/admin/auth/MFAEnrollment';
import BackupCodesDisplay from '@/components/admin/auth/BackupCodesDisplay';
import { useSetupWizard } from '@/hooks/useSetupWizard';

interface ValidateResponse {
  valid: boolean;
  adminName?: string;
  email?: string;
  role?: string;
  message?: string;
}

interface MfaQrResponse {
  secret: string;
  qrCodeUrl: string;
  qr_code_data_url?: string;
}

export default function AdminSetupPage(): React.ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const { step, next, previous } = useSetupWizard(3);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [secret, setSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('This invite link is invalid or has expired. Please contact your Super Admin for a new invite.');
      return;
    }

    void (async () => {
      const validateRes = await fetch(`/api/v1/admin/setup/validate?token=${encodeURIComponent(token)}`);
      const validateData = (await validateRes.json()) as ValidateResponse;
      if (!validateRes.ok || !validateData.valid) {
        setError(
          validateData.message ??
            'This invite link is invalid or has expired. Please contact your Super Admin for a new invite.'
        );
        return;
      }

      const qrRes = await fetch(`/api/v1/admin/setup/mfa-qr?token=${encodeURIComponent(token)}`);
      const qrData = (await qrRes.json()) as MfaQrResponse & { error?: string };
      if (!qrRes.ok) {
        setError(qrData.error ?? 'Unable to initialize MFA setup.');
        return;
      }

      setSecret(qrData.secret);
      setQrCodeUrl(qrData.qrCodeUrl || qrData.qr_code_data_url || '');
    })();
  }, [token]);

  const canProceedStep1 = password.length >= 12 && password === confirmPassword;
  const canProceedStep2 = totpCode.length === 6;

  const completeSetup = async () => {
    setIsCompleting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/v1/admin/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
          totpCode,
          backupCodesSaved: true,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; backupCodes?: string[]; error?: string };
      if (!res.ok || !data.ok || !data.backupCodes) {
        setError(data.error ?? 'Unable to complete setup.');
        return;
      }
      setBackupCodes(data.backupCodes);
      setSuccess('Setup complete. Redirecting to Admin Login...');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-b from-[#EEEDFE] to-white">
      <section className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Admin Account Setup</h1>
        <p className="text-sm text-gray-600 mb-5">Step {step} of 3</p>

        {error ? <p className="mb-4 text-sm text-[#E24B4A]">{error}</p> : null}
        {success ? <p className="mb-4 text-sm text-[#1D9E75]">{success}</p> : null}

        {step === 1 ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium mb-1">Confirm password</label>
              <input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <PasswordStrengthMeter password={password} />
          </div>
        ) : null}

        {step === 2 ? (
          <MFAEnrollment
            qrCodeUrl={qrCodeUrl}
            secret={secret}
            totpCode={totpCode}
            onTotpCodeChange={setTotpCode}
          />
        ) : null}

        {step === 3 ? (
          <BackupCodesDisplay
            backupCodes={backupCodes}
            acknowledged={acknowledged}
            onAcknowledgeChange={setAcknowledged}
          />
        ) : null}

        <div className="mt-6 flex items-center gap-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={previous}
              className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 font-semibold"
            >
              Back
            </button>
          ) : null}

          {step < 3 ? (
            <button
              type="button"
              disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
              onClick={next}
              className="min-h-[44px] rounded-lg bg-[#534AB7] text-white font-semibold px-4 py-2 disabled:opacity-60"
            >
              Continue
            </button>
          ) : backupCodes.length === 0 ? (
            <button
              type="button"
              onClick={completeSetup}
              disabled={isCompleting}
              className="min-h-[44px] rounded-lg bg-[#534AB7] text-white font-semibold px-4 py-2 disabled:opacity-60"
            >
              {isCompleting ? 'Completing...' : 'Complete Setup'}
            </button>
          ) : (
            <button
              type="button"
              disabled={!acknowledged}
              onClick={() => router.push('/admin/login')}
              className="min-h-[44px] rounded-lg bg-[#1D9E75] text-white font-semibold px-4 py-2 disabled:opacity-60"
            >
              Go to Admin Login
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
