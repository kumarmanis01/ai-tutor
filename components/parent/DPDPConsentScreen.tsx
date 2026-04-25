/**
 * FILE OBJECTIVE:
 * - P1.2-P: DPDP consent checklist screen shown to parent after child profiles are
 *   created. Presents what data is used and what controls the parent has.
 *   Posts to /api/parent/consent/grant on approval, then calls onConsent().
 *   Offers "I Need More Information" link that opens the ConsentFAQModal.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/DPDPConsentScreen.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | staff-engineer | created per P1.2-P AC
 */

'use client';

import { useState } from 'react';
import ConsentFAQModal from './ConsentFAQModal';

interface DPDPConsentScreenProps {
  childName: string;
  childId: string;
  onConsent: () => void;
  onNeedInfo?: () => void;
}

const ALLOWED: string[] = [
  'View learning topics, session history, and progress reports',
  'Set weekly session limits from your parent dashboard',
  'Receive weekly email summaries every Sunday',
  'Withdraw consent at any time from Parent Settings',
];

const NOT_SHARED: string[] = [
  'Data will NOT be sold to advertisers or third parties',
  'No social features -- no chat, no friend requests',
  'No direct marketing to your child',
];

export default function DPDPConsentScreen({
  childName,
  childId,
  onConsent,
  onNeedInfo,
}: DPDPConsentScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFaq, setShowFaq] = useState(false);

  async function handleConsent() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/parent/consent/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't activate account. Please try again.");
        return;
      }
      onConsent();
    } catch (err: unknown) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleNeedInfo() {
    setShowFaq(true);
    onNeedInfo?.();
  }

  return (
    <>
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Activate {childName}&apos;s account
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Under India&apos;s DPDP Act 2023, your consent is required to process your child&apos;s
            learning data.
          </p>
        </div>

        <div className="bg-[#EAF3DE] rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            As a parent you can:
          </p>
          <ul className="space-y-2">
            {ALLOWED.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <span className="mt-0.5 text-[#1D9E75] text-base leading-none" aria-hidden="true">
                  &#x2705;
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#FCEBEB] rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">We promise:</p>
          <ul className="space-y-2">
            {NOT_SHARED.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <span className="mt-0.5 text-[#E24B4A] text-base leading-none" aria-hidden="true">
                  &#x274C;
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p role="alert" className="text-sm text-[#E24B4A] bg-[#FCEBEB] rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleConsent}
          disabled={loading}
          className="w-full bg-[#FF6B35] text-white font-bold text-base rounded-2xl
            py-4 px-6 min-h-[52px] hover:bg-[#e85a25] active:scale-95 transition-all
            disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Activating...' : `I Consent -- Activate ${childName}'s Account`}
        </button>

        <button
          type="button"
          onClick={handleNeedInfo}
          className="w-full text-[#534AB7] font-medium text-sm py-3 min-h-[44px]
            hover:underline transition-colors"
        >
          I Need More Information
        </button>

        <p className="text-xs text-gray-400 text-center">
          Spinzy Academy complies with India&apos;s Digital Personal Data Protection Act (DPDP)
          2023.{' '}
          <a href="/privacy" className="underline hover:text-[#534AB7]">
            Privacy Policy
          </a>
        </p>
      </div>

      {showFaq && <ConsentFAQModal onClose={() => setShowFaq(false)} />}
    </>
  );
}
