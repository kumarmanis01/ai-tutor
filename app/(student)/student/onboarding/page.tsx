'use client';

/**
 * Student onboarding — profile setup (Screen 3)
 *
 * Uses ProfileSetupForm (4-step wizard) to collect board, class, medium, subjects.
 * Reads ?age= from registration redirect to pre-fill age.
 * On save: POSTs to /api/user/onboarding, then redirects to exam-date.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import ProfileSetupForm, { type ProfileValues } from '@/components/student/onboarding/ProfileSetupForm';

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ageParam = searchParams.get('age');
  const initialAge = ageParam ? Number(ageParam) : undefined;

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleSave(values: ProfileValues) {
    setSaveError('');
    setSaving(true);
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: values.board,
          class_grade: values.grade,
          preferred_language: values.language,
          subjects: values.subjects,
          age: values.age ?? initialAge,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSaveError(json?.error ?? 'Could not save profile. Please try again.');
        return;
      }
      router.push('/student/onboarding/exam-date');
    } catch {
      setSaveError('Network error. Please check your connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8 flex flex-col">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#534AB7] flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#534AB7]/30">
            <span className="text-white font-bold text-lg leading-none">S</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Set up your profile</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            This takes under a minute. Vidya will personalise your learning plan.
          </p>
        </div>

        <ProfileSetupForm
          initialAge={initialAge}
          saving={saving}
          saveError={saveError}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}

export default function StudentOnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-sm text-gray-400 dark:text-gray-500">Loading…</div>
      </div>
    }>
      <OnboardingInner />
    </Suspense>
  );
}
