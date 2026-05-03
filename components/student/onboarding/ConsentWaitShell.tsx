'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { QuickDiagnosticQuiz } from '@/components/student/onboarding/QuickDiagnosticQuiz';

type ConsentWaitShellProps = {
  studentId: string;
  grade: number;
  board: string;
  initialConsentGranted: boolean;
  initialFirstSubjectId: string | null;
};

const BUDDY_NAMES = ['Vidya', 'Arya', 'Riya', 'Rohan', 'Ananya'] as const;
type BuddyName = typeof BUDDY_NAMES[number];

const POLL_INTERVAL_MS = 15_000;

export default function ConsentWaitShell({
  studentId,
  grade,
  board,
  initialConsentGranted,
  initialFirstSubjectId,
}: ConsentWaitShellProps) {
  const router = useRouter();
  const [consentGranted, setConsentGranted] = useState(initialConsentGranted);
  const [firstSubjectId, setFirstSubjectId] = useState(initialFirstSubjectId);
  const [selectedBuddy, setSelectedBuddy] = useState<BuddyName | null>(null);
  const [quizDone, setQuizDone] = useState(false);
  const [polling, setPolling] = useState(false);

  const checkConsent = useCallback(async () => {
    setPolling(true);
    try {
      const res = await fetch('/api/student/consent-status');
      if (!res.ok) return;
      const data = (await res.json()) as {
        consentGranted: boolean;
        firstSubjectId: string | null;
      };
      setConsentGranted(data.consentGranted);
      if (data.firstSubjectId) setFirstSubjectId(data.firstSubjectId);
    } catch {
      // silent -- will retry on next poll
    } finally {
      setPolling(false);
    }
  }, []);

  // Auto-poll for consent approval
  useEffect(() => {
    if (consentGranted) return;
    const id = setInterval(() => { void checkConsent(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [consentGranted, checkConsent]);

  function handleContinue() {
    if (!consentGranted) return;
    if (firstSubjectId) {
      router.push(`/diagnostic/${firstSubjectId}`);
    } else {
      router.push('/dashboard');
    }
  }

  const canContinue = consentGranted && (!!firstSubjectId || true);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">

        {/* Consent status banner */}
        <div
          className={`rounded-2xl border px-5 py-4 ${
            consentGranted
              ? 'border-[#1D9E75]/30 bg-[#EAF3DE] dark:bg-[#1D9E75]/10'
              : 'border-[#BA7517]/30 bg-[#FAEEDA] dark:bg-[#BA7517]/10'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-2xl" aria-hidden="true">
              {consentGranted ? '' : ''}
            </span>
            <div className="flex-1">
              {consentGranted ? (
                <>
                  <p className="font-semibold text-[#1D9E75]">Parent approved!</p>
                  <p className="mt-0.5 text-sm text-[#1D9E75]/80">
                    Your account is fully activated. You can now take your full diagnostic test.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-[#BA7517]">Waiting for parent approval</p>
                  <p className="mt-0.5 text-sm text-[#BA7517]/80">
                    We have sent a verification request to your parent. You can explore while you wait.
                  </p>
                  <button
                    type="button"
                    onClick={() => { void checkConsent(); }}
                    disabled={polling}
                    className="mt-2 min-h-[36px] rounded-lg border border-[#BA7517]/40 px-3 text-xs font-semibold text-[#BA7517] hover:bg-[#BA7517]/10 disabled:opacity-50"
                  >
                    {polling ? 'Checking...' : 'Check approval status'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Study buddy selection */}
        {!selectedBuddy && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/logos/vidya/vidya-avatar-64.png"
                alt="Vidya"
                width={40}
                height={40}
                className="rounded-full"
              />
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100">Meet your Study Buddy</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Choose a name for your AI tutor
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {BUDDY_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedBuddy(name)}
                  className="min-h-[44px] rounded-xl border-2 border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 hover:border-[#534AB7] hover:bg-[#EEEDFE] hover:text-[#534AB7] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 transition-all"
                >
                  {name}
                </button>
              ))}
            </div>
          </section>
        )}

        {selectedBuddy && !quizDone && (
          <div className="rounded-2xl border border-[#534AB7]/20 bg-[#EEEDFE] px-4 py-3 dark:bg-[#534AB7]/10">
            <p className="text-sm font-semibold text-[#534AB7]">
              {selectedBuddy} is ready to help you learn!
            </p>
            <p className="text-xs text-[#534AB7]/80 mt-0.5">
              Complete the quick quiz so {selectedBuddy} can personalise your learning path.
            </p>
          </div>
        )}

        {/* Quick placement quiz -- available while waiting */}
        {!quizDone ? (
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="px-5 pt-5 pb-2">
              <h2 className="font-bold text-gray-900 dark:text-gray-100">Quick Placement Quiz</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                5 quick questions to personalise your learning while you wait.
              </p>
            </div>
            <QuickDiagnosticQuiz
              grade={grade}
              board={board}
              studentId={studentId}
              accessToken={`quick:${studentId}`}
              isExploreMode={false}
              onComplete={() => setQuizDone(true)}
            />
          </section>
        ) : (
          <div className="rounded-2xl border border-[#1D9E75]/30 bg-[#EAF3DE] px-5 py-4 dark:bg-[#1D9E75]/10">
            <p className="font-semibold text-[#1D9E75]">Quick quiz done!</p>
            <p className="text-sm text-[#1D9E75]/80 mt-0.5">
              {consentGranted
                ? "Your parent has approved. You can now start your full diagnostic."
                : "Waiting for parent approval before the full diagnostic."}
            </p>
          </div>
        )}

        {/* Continue CTA -- only active when consent is granted */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full min-h-[52px] rounded-2xl bg-[#534AB7] text-white font-semibold text-base hover:bg-[#4238a3] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {consentGranted ? 'Start Full Diagnostic ->' : 'Waiting for parent approval...'}
        </button>

      </div>
    </div>
  );
}
