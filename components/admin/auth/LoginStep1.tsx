/**
 * FILE OBJECTIVE:
 * - Admin login credentials step UI (email + password) for A0.3.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/auth/LoginStep1.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:08:00Z | copilot | created admin login step 1 component
 */

'use client';

import React, { useState } from 'react';

interface LoginStep1Props {
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export function LoginStep1({ onSubmit, isLoading = false, error }: LoginStep1Props): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({ email, password });
      }}
    >
      <div>
        <label htmlFor="admin-email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="admin-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 bg-white text-gray-900"
        />
      </div>

      <div>
        <label htmlFor="admin-password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 bg-white text-gray-900"
        />
      </div>

      {error ? <p className="text-sm text-[#E24B4A]">{error}</p> : null}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full min-h-[44px] rounded-lg bg-[#534AB7] text-white font-semibold px-4 py-2 disabled:opacity-60"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}

export default LoginStep1;
