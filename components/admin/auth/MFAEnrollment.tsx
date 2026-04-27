/**
 * FILE OBJECTIVE:
 * - Render QR-code MFA enrollment step for admin setup.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/auth/MFAEnrollment.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:11:00Z | copilot | created MFA enrollment component for admin setup flow
 */

'use client';

import React from 'react';

interface MFAEnrollmentProps {
  qrCodeUrl: string;
  secret: string;
  totpCode: string;
  onTotpCodeChange: (code: string) => void;
}

export function MFAEnrollment({
  qrCodeUrl,
  secret,
  totpCode,
  onTotpCodeChange,
}: MFAEnrollmentProps): React.ReactElement {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">Scan this QR with your authenticator app.</p>
      <img
        src={qrCodeUrl}
        alt="MFA enrollment QR code"
        width={220}
        height={220}
        className="rounded-lg border border-gray-200"
      />
      <p className="text-xs text-gray-600">Manual setup key: <span className="font-mono">{secret}</span></p>
      <div>
        <label htmlFor="setup-totp" className="block text-sm font-medium mb-1">
          Enter 6-digit code
        </label>
        <input
          id="setup-totp"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={totpCode}
          onChange={(event) => onTotpCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 bg-white text-gray-900"
        />
      </div>
    </div>
  );
}

export default MFAEnrollment;
