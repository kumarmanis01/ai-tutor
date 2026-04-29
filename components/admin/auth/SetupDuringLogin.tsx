/**
 * FILE OBJECTIVE:
 * - Render forced MFA enrollment UI during first-time login (show QR, manual key, verify TOTP, and surface backup codes).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/auth/SetupDuringLogin.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | added session-based MFA setup UI for first-login flow
 */

'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import BackupCodesDisplay from '@/components/admin/auth/BackupCodesDisplay';

interface Props {
  loginSessionToken: string;
  onComplete: () => void;
}

export default function SetupDuringLogin({ loginSessionToken, onComplete }: Props) {
  const [secret, setSecret] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [ack, setAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loginSessionToken) return;
    void (async () => {
      setError(null);
      try {
        const res = await fetch(`/api/v1/admin/setup/session-mfa-qr?sessionToken=${encodeURIComponent(
          loginSessionToken
        )}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to initialize MFA setup');
        setSecret(data.secret || '');
        setQrUrl(data.qrCodeUrl || data.qr_code_data_url || '');
      } catch (err) {
        setError(String(err));
      }
    })();
  }, [loginSessionToken]);

  const complete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/setup/session-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginSessionToken, totpCode, backupCodesSaved: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Unable to complete MFA setup');
        return;
      }
      // Store tokens in localStorage so useAdminAuth stays in sync with the cookie
      if (data.accessToken) localStorage.setItem('admin_access_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('admin_refresh_token', data.refreshToken);
      localStorage.setItem('admin_login_at', String(Date.now()));
      setBackupCodes(data.backupCodes || []);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <p className="text-sm text-[#E24B4A]">{error}</p>;
  }

  if (backupCodes.length > 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-2">Backup codes</h2>
        <BackupCodesDisplay backupCodes={backupCodes} acknowledged={ack} onAcknowledgeChange={setAck} />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={!ack}
            onClick={() => onComplete()}
            className="min-h-[44px] rounded-lg bg-[#534AB7] text-white font-semibold px-4 py-2 disabled:opacity-60"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">Welcome -- set up two-factor authentication for this account.</p>
      {qrUrl ? (
        <Image src={qrUrl} alt="MFA QR" width={220} height={220} className="rounded-lg border border-gray-200" />
      ) : null}
      {secret ? (
        <p className="text-xs text-gray-600">Manual setup key: <span className="font-mono">{secret}</span></p>
      ) : null}

      <div>
        <label htmlFor="totp" className="block text-sm font-medium mb-1">Enter 6-digit code</label>
        <input
          id="totp"
          inputMode="numeric"
          maxLength={6}
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 bg-white text-gray-900"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={complete}
          disabled={loading || totpCode.length !== 6}
          className="min-h-[44px] rounded-lg bg-[#534AB7] text-white font-semibold px-4 py-2 disabled:opacity-60"
        >
          {loading ? 'Completing...' : 'Verify & Generate Backup Codes'}
        </button>
      </div>
    </div>
  );
}
