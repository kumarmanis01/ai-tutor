'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { Spinner } from '@/components/UI/design-system';

type Step = 'loading' | 'select' | 'saving';

const ROLE_DASHBOARD: Record<string, string> = {
  student: '/student/dashboard',
  parent: '/parent/dashboard',
  admin: '/admin',
  moderator: '/admin',
};

export default function RoleSelectionPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace('/auth/get-started');
      return;
    }

    // Existing user with a specific role goes straight to their dashboard.
    const role = (session?.user as { role?: string })?.role ?? '';
    if (role && role !== 'user' && ROLE_DASHBOARD[role]) {
      router.replace(ROLE_DASHBOARD[role]);
      return;
    }

    setStep('select');
  }, [status, session, router]);

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
      await update();
      router.replace(data.redirect);
    } catch {
      setError('Something went wrong. Please try again.');
      setStep('select');
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
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
                       rounded-2xl border-2 border-primary bg-primary-bg
                       hover:bg-primary hover:text-white
                       text-primary font-semibold text-base
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
                       rounded-2xl border-2 border-success bg-success-bg
                       hover:bg-success hover:text-white
                       text-success font-semibold text-base
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
            <Spinner size="sm" />
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-error">{error}</p>
        )}
      </div>
    </div>
  );
}
