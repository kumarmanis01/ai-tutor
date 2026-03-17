'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { ProfileMissingField } from '@/lib/student/profileGuard';

interface ProfileCompletionGateProps {
  missingFields: ProfileMissingField[];
}

const GATE_FIELDS: { key: ProfileMissingField; label: string }[] = [
  { key: 'board', label: 'Board' },
  { key: 'grade', label: 'Class' },
  { key: 'language', label: 'Medium' },
  { key: 'subjects', label: 'Subjects' },
];

export default function ProfileCompletionGate({ missingFields }: ProfileCompletionGateProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const items = GATE_FIELDS.map((f) => ({ ...f, filled: !missingFields.includes(f.key) }));
  const completedCount = items.filter((i) => i.filled).length;
  const total = GATE_FIELDS.length;

  const gate = (
    <div className="fixed inset-0 z-[9000] flex flex-col bg-white dark:bg-gray-950">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            Complete your profile
          </h1>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            We need a few details before you can start learning.
          </p>

          {/* Progress bar */}
          <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{completedCount} of {total} complete</span>
          </div>
          <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-[#534AB7] transition-all"
              style={{ width: `${Math.round((completedCount / total) * 100)}%` }}
            />
          </div>

          {/* Checklist */}
          <ul className="mb-8 space-y-3">
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    item.filled
                      ? 'bg-[#EAF3DE] text-[#1D9E75] dark:bg-[#1D9E75]/20 dark:text-[#1D9E75]'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                  }`}
                >
                  {item.filled ? '✓' : '○'}
                </span>
                <span
                  className={
                    item.filled
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'font-medium text-gray-900 dark:text-gray-100'
                  }
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => router.push('/student/onboarding')}
            className="min-h-[44px] w-full rounded-lg bg-[#534AB7] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4239a3]"
          >
            Complete your profile
          </button>
        </div>
      </div>
    </div>
  );

  // Render via portal to document.body so the gate sits outside any
  // scroll-container ancestor, guaranteeing pointer-event delivery.
  if (!mounted) return null;
  return createPortal(gate, document.body);
}
