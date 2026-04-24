/**
 * FILE OBJECTIVE:
 * - P1.2-P: FAQ modal shown when parent selects "I Need More Information" on the
 *   DPDP consent screen. Answers common questions about data privacy, consent
 *   withdrawal, and links to the full Privacy Policy.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/ConsentFAQModal.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | staff-engineer | created per P1.2-P AC
 */

'use client'

import { useEffect, useRef } from 'react'

interface ConsentFAQModalProps {
  onClose: () => void
}

const FAQS = [
  {
    q: 'What data do you collect about my child?',
    a: 'We collect the topics your child studies, session duration, quiz scores, and progress over time. We never collect personal data beyond what is needed for the tutoring service.',
  },
  {
    q: 'Can I withdraw my consent later?',
    a: "Yes. Go to Parent Settings at any time and click \"Revoke Consent\". Your child's account will be paused and we will stop processing their data within 24 hours.",
  },
  {
    q: 'Is my child\'s data shared with schools or advertisers?',
    a: 'No. We do not share data with schools, advertisers, or any third party for commercial purposes. Data is processed only to personalise your child\'s learning.',
  },
  {
    q: 'Who can see my child\'s progress?',
    a: "Only you (as the linked parent) and Spinzy's internal support team (when resolving issues) can view your child's progress. Your child cannot see their own raw scores.",
  },
  {
    q: 'What if I have more questions?',
    a: 'Email us at hello@spinzyacademy.com. We typically respond within one business day.',
  },
]

export default function ConsentFAQModal({ onClose }: ConsentFAQModalProps) {
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  // Trap focus and close on Escape
  useEffect(() => {
    firstButtonRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Privacy FAQ"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Privacy FAQ</h2>
          <button
            ref={firstButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close FAQ"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
              min-h-[44px] min-w-[44px] flex items-center justify-center text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-5">
          {FAQS.map(({ q, a }) => (
            <div key={q}>
              <p className="font-semibold text-gray-800 dark:text-white text-sm">{q}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-gray-100 dark:border-gray-800">
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm text-[#534AB7] font-medium hover:underline mb-4"
          >
            Read Full Privacy Policy &rarr;
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-[#534AB7] text-white font-bold rounded-2xl py-3 min-h-[48px]
              hover:bg-[#4239a0] transition-colors"
          >
            Got it, go back
          </button>
        </div>
      </div>
    </div>
  )
}
