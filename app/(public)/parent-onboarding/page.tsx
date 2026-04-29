/**
 * FILE OBJECTIVE:
 * - P1.1-P / P1.2-P: Three-step parent onboarding wizard:
 *     1. Add child profiles (AddChildForm)
 *     2. Grant DPDP consent for each child (DPDPConsentScreen)
 *     3. Success screen with link to parent dashboard
 *   Requires an authenticated session; redirects to sign-in if not logged in.
 *   Lives in (public) route group so new-user role=user can access it.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/parent-onboarding/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | staff-engineer | created per P1.1-P and P1.2-P AC
 * - 2026-04-29T00:00:00Z | claude | replace inline success with SetupComplete (S0.5 / P1.3-P)
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AddChildForm, { type CreatedChild } from '@/components/parent/AddChildForm';
import DPDPConsentScreen from '@/components/parent/DPDPConsentScreen';
import SetupComplete from '@/components/parent/SetupComplete';

type Step = 'loading' | 'add_child' | 'consent' | 'success';

export default function ParentOnboardingPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<Step>('loading');
  const [children, setChildren] = useState<CreatedChild[]>([]);
  const [consentIndex, setConsentIndex] = useState(0);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/parent-onboarding');
      return;
    }
    setStep('add_child');
  }, [sessionStatus, router]);

  function handleChildrenCreated(created: CreatedChild[]) {
    setChildren(created);
    setConsentIndex(0);
    setStep('consent');
  }

  function handleConsentGranted() {
    const next = consentIndex + 1;
    if (next < children.length) {
      setConsentIndex(next);
    } else {
      setStep('success');
    }
  }

  const _session = session; // satisfy no-unused-vars -- session is validated via sessionStatus check above

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <PageWrapper step={0}>
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
        </div>
      </PageWrapper>
    );
  }

  if (step === 'add_child') {
    return (
      <PageWrapper step={1}>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Add your child</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Tell us a little about your child so Vidya can personalise their lessons.
        </p>
        <AddChildForm onSuccess={handleChildrenCreated} />
      </PageWrapper>
    );
  }

  if (step === 'consent') {
    const child = children[consentIndex];
    if (!child) {
      setStep('success');
      return null;
    }
    return (
      <PageWrapper step={2}>
        {children.length > 1 && (
          <p className="text-xs text-gray-400 mb-4 text-center">
            Child {consentIndex + 1} of {children.length}
          </p>
        )}
        <DPDPConsentScreen
          childName={child.name}
          childId={child.id}
          onConsent={handleConsentGranted}
        />
      </PageWrapper>
    );
  }

  // success -- show the "Send to Child" screen (S0.5 / P1.3-P)
  return (
    <PageWrapper step={3}>
      <SetupComplete children={children} />
    </PageWrapper>
  );
}

// ── Shared wrapper ──────────────────────────────────────────────────────────

const STEPS = ['Add child', 'Give consent', 'Done'];

function PageWrapper({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-start sm:items-center justify-center py-12 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-[#534AB7] font-extrabold text-lg tracking-tight">
            Spinzy Academy
          </span>
        </div>

        {/* Step indicator */}
        {step > 0 && step < 4 && (
          <div className="flex items-center gap-2 mb-6" aria-label="Progress">
            {STEPS.map((label, idx) => {
              const num = idx + 1;
              const active = num === step;
              const done = num < step;
              return (
                <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
                  <div
                    aria-current={active ? 'step' : undefined}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                      ${done ? 'bg-[#1D9E75] text-white' : active ? 'bg-[#534AB7] text-white' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}
                  >
                    {done ? '✓' : num}
                  </div>
                  <span
                    className={`text-xs hidden sm:inline ${active ? 'text-[#534AB7] font-semibold' : 'text-gray-400'}`}
                  >
                    {label}
                  </span>
                  {idx < STEPS.length - 1 && (
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
