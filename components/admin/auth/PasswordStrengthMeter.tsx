/**
 * FILE OBJECTIVE:
 * - Password strength meter component for admin setup wizard.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/auth/PasswordStrengthMeter.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:08:00Z | copilot | created password strength meter for A0.2 setup step 1
 */

'use client';

import React from 'react';

function scorePassword(password: string): number {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, Math.max(0, score - 1));
}

export interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps): React.ReactElement {
  const score = scorePassword(password);
  const label = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][score];

  return (
    <div aria-live="polite" className="space-y-1.5">
      <div className="flex gap-1" role="presentation">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`h-2 flex-1 rounded-full ${
              index < score
                ? score >= 3
                  ? 'bg-[#1D9E75]'
                  : 'bg-[#BA7517]'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-300">Strength: {label}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">Minimum score required: 3/4</p>
    </div>
  );
}

export default PasswordStrengthMeter;
