/**
 * FILE OBJECTIVE:
 * - Render the student-facing parent access card for generating invite codes, viewing linked parents, and explaining parent onboarding steps.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Profile/ParentAccessCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-11T00:00:00Z | copilot | add clear share and parent onboarding instructions for invite code flow
 * - 2026-05-11T00:00:00Z | copilot | copy parent onboarding URL instead of raw code so role assignment starts from shared route
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';

type ParentViewResponse = {
  linkedParents: {
    name: string;
    email: string | null;
    whatsapp: string | null;
    source: 'account_link' | 'contact_email' | 'contact_whatsapp';
    emailStatus: 'verified' | 'unverified' | null;
    whatsappStatus: 'verified' | 'unverified' | null;
  }[];
  pendingInvites: { code: string; createdAt: string; expiresAt?: string }[];
  verification?: {
    accountVerified: boolean;
    email: { configured: boolean; verified: boolean; masked: string | null };
    whatsapp: { configured: boolean; verified: boolean; masked: string | null };
  };
  parentCanSee: {
    attentionFlags: Array<{ subject: string; chapter: string; masteryLevel: string; accuracy: number; reason: string }>;
    readiness: Array<{ subject: string; readinessScore: number; readinessLabel: string; coveragePercent: number }>;
    note: string;
  };
};

const PARENT_SIGNIN_PATH = '/auth/signin';
const PARENT_ONBOARDING_PATH = '/parent/onboarding';

function buildParentInviteLink(code: string): string {
  const inviteCode = String(code ?? '').trim().toUpperCase();
  const callbackUrl = inviteCode
    ? `${PARENT_ONBOARDING_PATH}?inviteCode=${encodeURIComponent(inviteCode)}`
    : PARENT_ONBOARDING_PATH;

  const query = `role=parent&callbackUrl=${encodeURIComponent(callbackUrl)}${
    inviteCode ? `&inviteCode=${encodeURIComponent(inviteCode)}` : ''
  }`;

  if (typeof window === 'undefined') {
    return `${PARENT_SIGNIN_PATH}?${query}`;
  }

  return `${window.location.origin}${PARENT_SIGNIN_PATH}?${query}`;
}

export default function ParentAccessCard() {
    const statusClassNameByState: Record<'verified' | 'unverified', string> = {
      verified: 'bg-[#EAF3DE] text-[#1D9E75] dark:bg-[#1D9E75]/20 dark:text-[#8EE2C8]',
      unverified: 'bg-[#FCEBEB] text-[#E24B4A] dark:bg-[#E24B4A]/20 dark:text-[#F6A2A2]',
    };

  const [data, setData] = useState<ParentViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/parent-view');
      if (!res.ok) throw new Error('Failed to load');
      setData(await res.json());
    } catch (err) {
      logger.error('ParentAccessCard.fetch failed', { error: String(err) });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/student/parent-view', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast((json as any)?.error || 'Failed to generate code');
        return;
      }
      toast('Invite code generated');
      await fetchData();
    } catch (err) {
      logger.error('ParentAccessCard.generate failed', { error: String(err) });
      toast('Failed to generate code');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(buildParentInviteLink(code));
      toast('Parent invite link copied');
    } catch {
      toast('Copy failed');
    }
  };

  const onboardingSteps = [
    'Tap Generate code to create a secure invite code.',
    'Tap Copy link and share it with your parent on WhatsApp, SMS, or email.',
    'Parent opens the link, signs in, and lands on parent onboarding.',
    'In Link Student, the invite code is prefilled. Parent selects relationship and submits.',
    'After linking, parent appears in Linked parents and can monitor your progress.',
  ];

  return (
    <section className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">Parent Access</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Generate an invite code to let a parent securely view your progress.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-[#534AB7] text-white hover:bg-[#3C3489] disabled:opacity-60"
        >
          {busy ? 'Working...' : 'Generate code'}
        </button>
      </div>

      <div className="rounded-lg bg-[#EEEDFE] dark:bg-[#2C2754] border border-[#534AB7]/30 p-4">
        <div className="text-sm font-semibold text-[#3C3489] dark:text-[#D9D5FF]">How to share and link</div>
        <ol className="mt-2 space-y-1.5 text-sm text-gray-700 dark:text-gray-200 list-decimal list-inside">
          {onboardingSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          Invite codes expire automatically. If a code expires, generate a new one and share again.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-4">
              <div className="text-sm font-semibold mb-2">Active invites</div>
              {data?.pendingInvites?.length ? (
                <div className="space-y-2">
                  {data.pendingInvites.map((i) => (
                    <div key={i.code} className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono tracking-widest text-lg">{i.code}</div>
                        {i.expiresAt && (
                          <div className="text-xs text-gray-500">
                            Expires: {new Date(i.expiresAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => copy(i.code)}
                        className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200"
                      >
                        Copy link
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No active invite codes.</div>
              )}
            </div>

            <div className="rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-4">
              <div className="text-sm font-semibold mb-2">Linked parents</div>
              {data?.linkedParents?.length ? (
                <ul className="space-y-1 text-sm">
                  {data.linkedParents.map((p, idx) => (
                    <li key={`${p.name}-${p.email ?? p.whatsapp ?? idx}`} className="rounded-md border border-gray-200 dark:border-slate-700 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.source !== 'account_link' ? (
                          <span className="text-[10px] uppercase tracking-wide text-gray-500">Auto-linked</span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-gray-500">{p.email ?? p.whatsapp ?? '--'}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.emailStatus ? (
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusClassNameByState[p.emailStatus]}`}>
                            Email {p.emailStatus}
                          </span>
                        ) : null}
                        {p.whatsappStatus ? (
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusClassNameByState[p.whatsappStatus]}`}>
                            WhatsApp {p.whatsappStatus}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">No parents linked yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-4">
            <div className="text-sm font-semibold mb-2">What parents can see</div>
            <p className="text-sm text-gray-600 dark:text-gray-300">{data?.parentCanSee?.note ?? ''}</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Attention flags (sample)</div>
                <div className="text-sm">
                  {data?.parentCanSee?.attentionFlags?.length ? (
                    <ul className="space-y-1">
                      {data.parentCanSee.attentionFlags.slice(0, 5).map((a, idx) => (
                        <li key={idx} className="flex items-center justify-between">
                          <span>{a.subject} / {a.chapter}</span>
                          <span className="text-gray-500">{Math.round(a.accuracy * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-gray-500">None right now.</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Readiness (sample)</div>
                <div className="text-sm">
                  {data?.parentCanSee?.readiness?.length ? (
                    <ul className="space-y-1">
                      {data.parentCanSee.readiness.slice(0, 5).map((r, idx) => (
                        <li key={idx} className="flex items-center justify-between">
                          <span className="capitalize">{r.subject}</span>
                          <span className="text-gray-700 dark:text-gray-200 font-medium">{r.readinessScore}%</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-gray-500">No readiness data yet.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

