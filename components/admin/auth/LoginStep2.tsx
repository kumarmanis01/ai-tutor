/**
 * FILE OBJECTIVE:
 * - Admin login MFA step UI with TOTP and backup-code toggle.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/auth/LoginStep2.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:08:00Z | copilot | created admin login step 2 component with OTPInput reuse
 */

'use client';

import React, { useState } from 'react';
import OTPInput from '@/components/parent/OTPInput';

interface LoginStep2Props {
  onSubmit: (payload: { totpCode?: string; backupCode?: string; rememberDevice?: boolean }) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export function LoginStep2({ onSubmit, isLoading = false, error }: LoginStep2Props): React.ReactElement {
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({
          totpCode: useBackupCode ? undefined : totpCode,
          backupCode: useBackupCode ? backupCode.trim().toUpperCase() : undefined,
          rememberDevice,
        });
      }}
    >
      {!useBackupCode ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">Enter your 6-digit authenticator code</p>
          <OTPInput onComplete={(code) => setTotpCode(code)} />
        </div>
      ) : (
        <div>
          <label htmlFor="backup-code" className="block text-sm font-medium mb-1">
            Backup code
          </label>
          <input
            id="backup-code"
            type="text"
            minLength={8}
            maxLength={8}
            required
            value={backupCode}
            onChange={(event) => setBackupCode(event.target.value)}
            className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 bg-white text-gray-900 uppercase"
          />
        </div>
      )}

      <button
        type="button"
        className="text-sm text-[#534AB7] underline"
        onClick={() => setUseBackupCode((v) => !v)}
      >
        {useBackupCode ? 'Use authenticator code' : 'Use Backup Code'}
      </button>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={rememberDevice}
          onChange={(event) => setRememberDevice(event.target.checked)}
        />
        Remember this device for 30 days
      </label>

      {error ? <p className="text-sm text-[#E24B4A]">{error}</p> : null}

      <button
        type="submit"
        disabled={isLoading || (!useBackupCode && totpCode.length !== 6) || (useBackupCode && backupCode.length !== 8)}
        className="w-full min-h-[44px] rounded-lg bg-[#534AB7] text-white font-semibold px-4 py-2 disabled:opacity-60"
      >
        {isLoading ? 'Verifying...' : 'Verify'}
      </button>
    </form>
  );
}

export default LoginStep2;
