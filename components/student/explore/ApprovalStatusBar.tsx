/**
 * FILE OBJECTIVE:
 * - Expandable approval status bar for Explore Mode. Shows the three consent milestones
 *   (Profile Created → Approval Sent → Parent Approved) with a resend button.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/explore/ApprovalStatusBar.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 */

'use client';

import { useState } from 'react';
import type { ConsentStatus } from '@/hooks/useConsentStatus';

interface Props {
  status: ConsentStatus | null;
  expiresAt: string | null;
  sentTo: string | null;
  consentToken: string;
}

export default function ApprovalStatusBar({ status, expiresAt, sentTo, consentToken }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  async function handleResend() {
    setResending(true);
    setResendMsg('');
    try {
      const res = await fetch('/api/v1/consent/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent_token: consentToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResendMsg(
          data.error === 'cooldown'
            ? 'Please wait before sending another reminder.'
            : 'Could not send. Try again.'
        );
      } else {
        setResendMsg('Reminder sent!');
      }
    } catch {
      setResendMsg('Network error. Try again.');
    } finally {
      setResending(false);
    }
  }

  const expiryLabel = expiresAt
    ? `Expires ${new Date(expiresAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}`
    : '';

  return (
    <div className="mx-4 my-2 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] text-sm font-semibold text-gray-800 dark:text-gray-200"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span>Approval Status</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <Milestone icon="✅" label="Profile Created" done />
          <Milestone
            icon="⏳"
            label="Approval Sent"
            pending={status === 'PENDING'}
            done={status !== 'PENDING' && status !== null}
          />
          <Milestone icon="⬜" label="Parent Approved" done={status === 'APPROVED'} />
          {sentTo && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sent to {sentTo}
              {expiryLabel ? `. ${expiryLabel}.` : '.'}
            </p>
          )}
          {resendMsg && <p className="text-xs text-[#1D9E75]">{resendMsg}</p>}
          <button
            disabled={resending}
            className="min-h-[44px] rounded-xl bg-[#EEEDFE] dark:bg-[#534AB7]/20 text-[#534AB7] dark:text-indigo-300 font-semibold text-sm disabled:opacity-40"
            onClick={() => {
              void handleResend();
            }}
          >
            {resending ? 'Sending...' : 'Send Reminder'}
          </button>
        </div>
      )}
    </div>
  );
}

function Milestone({
  icon,
  label,
  done,
  pending,
}: {
  icon: string;
  label: string;
  done?: boolean;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xl ${pending ? 'animate-pulse' : ''}`}>{icon}</span>
      <span
        className={`text-sm ${done ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400 dark:text-gray-500'}`}
      >
        {label}
      </span>
    </div>
  );
}
