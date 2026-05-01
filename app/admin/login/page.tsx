/**
 * FILE OBJECTIVE:
 * - Admin login page implementing two-step credentials + MFA flow for A0.3.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/login/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:14:00Z | copilot | created admin login page using reusable LoginStep1/LoginStep2 components
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import LoginStep1 from '@/components/admin/auth/LoginStep1';
import LoginStep2 from '@/components/admin/auth/LoginStep2';
import SetupDuringLogin from '@/components/admin/auth/SetupDuringLogin';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function AdminLoginPage(): React.ReactElement {
  const router = useRouter();
  const { isLoading, error, requiresMfa, setupRequired, loginSessionToken, login, verifyMfa } = useAdminAuth();

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-b from-[#EEEDFE] to-white">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">Spinzy Admin Login</h1>
        <p className="text-sm text-gray-600 mb-5">
          {requiresMfa ? 'Step 2 of 2: Verify MFA' : 'Step 1 of 2: Enter credentials'}
        </p>

        {requiresMfa ? (
          setupRequired ? (
            <SetupDuringLogin
              loginSessionToken={loginSessionToken}
              onComplete={() => router.push('/admin')}
            />
          ) : (
            <LoginStep2
              isLoading={isLoading}
              error={error}
              onSubmit={async (payload) => {
                const result = await verifyMfa(payload);
                if (result?.accessToken) {
                  router.push('/admin');
                }
              }}
            />
          )
        ) : (
          <LoginStep1
            isLoading={isLoading}
            error={error}
            onSubmit={async ({ email, password }) => {
              const result = await login(email, password);
              if (!result.requiresMfa && result.accessToken) {
                router.push('/admin');
              }
            }}
          />
        )}
      </section>
    </main>
  );
}
