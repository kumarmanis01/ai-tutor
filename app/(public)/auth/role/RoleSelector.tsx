'use client';

/**
 * FILE OBJECTIVE:
 * - Role selector UI for brand-new users (role = 'user').
 * - Only rendered when the server component in page.tsx determines no role
 *   has been set yet. Existing students/parents never see this component --
 *   they are server-redirected before this component is sent to the browser.
 *
 * LINKED UNIT TEST: none (pure UI, no business logic)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-06 | claude | extracted from page.tsx so page.tsx can be a server component
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

type Step = 'select' | 'saving';

export default function RoleSelector() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('select');
  const [error, setError] = useState('');

  async function handleRoleSelect(role: 'student' | 'parent') {
    setStep('saving');
    setError('');
    try {
      const res = await fetch('/api/auth/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok || !data.redirect) {
        setError('Something went wrong. Please try again.');
        setStep('select');
        return;
      }
      router.replace(data.redirect);
    } catch {
      setError('Something went wrong. Please try again.');
      setStep('select');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo variant="auth" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-4">
            Welcome! Tell us about yourself
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This helps us personalise your experience.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleRoleSelect('student')}
            disabled={step === 'saving'}
            className="w-full flex flex-col items-center gap-2 px-6 py-5 min-h-[44px]
                       rounded-2xl border-2 border-[#534AB7] bg-[#EEEDFE]
                       hover:bg-[#534AB7] hover:text-white
                       text-[#534AB7] font-semibold text-base
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-3xl">🎒</span>
            <span>I am a Student</span>
            <span className="text-xs font-normal opacity-70">
              Class 6-12 · CBSE / ICSE / State Board
            </span>
          </button>

          <button
            onClick={() => handleRoleSelect('parent')}
            disabled={step === 'saving'}
            className="w-full flex flex-col items-center gap-2 px-6 py-5 min-h-[44px]
                       rounded-2xl border-2 border-[#1D9E75] bg-[#EAF3DE]
                       hover:bg-[#1D9E75] hover:text-white
                       text-[#1D9E75] font-semibold text-base
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-3xl">👨‍👩‍👧</span>
            <span>I am a Parent</span>
            <span className="text-xs font-normal opacity-70">
              Monitor and support your child&apos;s progress
            </span>
          </button>
        </div>

        {step === 'saving' && (
          <div className="flex justify-center">
            <div className="w-6 h-6 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-[#E24B4A]">{error}</p>
        )}
      </div>
    </div>
  );
}
