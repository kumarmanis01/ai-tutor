/**
 * FILE OBJECTIVE:
 * - S0.5 / P1.3-P: "Send to Child" completion screen shown after parent onboarding.
 *   Renders one card per child with 3 delivery options:
 *     A. Send App Link via WhatsApp  (opens wa.me with pre-filled message)
 *     B. Send App Link via Email     (opens mailto: with pre-filled subject + body)
 *     C. Open on This Device         (navigates directly -- shared device flow)
 *   Calls POST /api/v1/parent/children/{id}/generate-claim-link lazily on first tap.
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | claude | created for S0.5 / P1.3-P
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SetupCompleteChild {
  id: string;
  name: string;
  grade: string;
  board: string;
  relation?: string;
}

interface SetupCompleteProps {
  children: SetupCompleteChild[];
}

interface ClaimLinkResponse {
  ok?: boolean;
  deepLink?: string;
  error?: string;
}

// ── Relation label ────────────────────────────────────────────────────────────

const RELATION_LABELS: Record<string, string> = {
  Mom: 'Mom',
  Dad: 'Dad',
  LegalGuardian: 'Legal Guardian',
};

function toRelationLabel(relation: string | undefined | null): string {
  if (!relation) return 'Your parent';
  return RELATION_LABELS[relation] ?? 'Your parent';
}

// ── Per-child card ────────────────────────────────────────────────────────────

function ChildSendCard({ child }: { child: SetupCompleteChild }) {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  async function resolveDeepLink(): Promise<string> {
    if (deepLink) return deepLink;
    setLinkError(null);
    setGenerating(true);
    try {
      const res = await fetch(`/api/v1/parent/children/${child.id}/generate-claim-link`, {
        method: 'POST',
      });
      const data = (await res.json()) as ClaimLinkResponse;
      if (!res.ok || !data.deepLink) {
        throw new Error(data.error ?? 'link_error');
      }
      setDeepLink(data.deepLink);
      return data.deepLink;
    } catch {
      setLinkError("Couldn't generate the app link. Tap to retry.");
      throw new Error('link_generation_failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleWhatsApp() {
    try {
      const link = await resolveDeepLink();
      const rel = toRelationLabel(child.relation);
      const text = encodeURIComponent(
        `Hey ${child.name}! Your Spinzy Academy learning app is ready!\n` +
          `${rel} has set up your account for Class ${child.grade} ${child.board}.\n` +
          `Tap here to start learning: ${link}\n` +
          `If you don't have the app yet, download it here: https://play.google.com/store/apps/details?id=com.spinzyacademy`
      );
      window.open(`https://wa.me/?text=${text}`, '_blank');
    } catch {}
  }

  async function handleEmail() {
    try {
      const link = await resolveDeepLink();
      const rel = toRelationLabel(child.relation);
      const subject = encodeURIComponent(
        `${child.name}, your Spinzy learning account is ready!`
      );
      const body = encodeURIComponent(
        `${rel} has set up your Spinzy Academy learning account for Class ${child.grade} ${child.board}.\n\n` +
          `Tap here to start learning: ${link}\n\n` +
          `If you don't have the app yet, download it here: https://play.google.com/store/apps/details?id=com.spinzyacademy\n\n` +
          `Happy learning!\nTeam Spinzy`
      );
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    } catch {}
  }

  async function handleSharedDevice() {
    try {
      const link = await resolveDeepLink();
      window.location.href = link;
    } catch {}
  }

  return (
    <div className="bg-[#EEEDFE] dark:bg-gray-800 rounded-2xl p-4 mb-4">
      <p className="font-semibold text-gray-800 dark:text-white mb-3 text-sm">
        How will{' '}
        <span className="text-[#534AB7] dark:text-[#8b84e0]">{child.name}</span> access
        Spinzy?
      </p>

      {linkError && (
        <p
          role="alert"
          className="mb-3 text-sm text-[#E24B4A] bg-[#FCEBEB] rounded-lg px-3 py-2"
        >
          {linkError}
        </p>
      )}

      <div className="space-y-2">
        {/* Option A -- WhatsApp */}
        <button
          type="button"
          disabled={generating}
          onClick={handleWhatsApp}
          className="w-full flex items-center gap-3 bg-[#25D366] text-white rounded-xl
            px-4 py-3 min-h-[52px] font-medium text-sm hover:bg-[#1ebe5d]
            active:scale-95 transition-all disabled:opacity-60 text-left"
        >
          <span className="text-xl shrink-0" aria-hidden="true">
            &#x1F4F1;
          </span>
          <span>Send App Link via WhatsApp</span>
        </button>

        {/* Option B -- Email */}
        <button
          type="button"
          disabled={generating}
          onClick={handleEmail}
          className="w-full flex items-center gap-3 bg-[#534AB7] text-white rounded-xl
            px-4 py-3 min-h-[52px] font-medium text-sm hover:bg-[#4239a0]
            active:scale-95 transition-all disabled:opacity-60 text-left"
        >
          <span className="text-xl shrink-0" aria-hidden="true">
            &#x2709;&#xFE0F;
          </span>
          <span>Send App Link via Email</span>
        </button>

        {/* Option C -- Shared device */}
        <button
          type="button"
          disabled={generating}
          onClick={handleSharedDevice}
          className="w-full flex items-center gap-3 bg-white border border-gray-200
            dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-white
            rounded-xl px-4 py-3 min-h-[52px] font-medium text-sm
            hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-95 transition-all
            disabled:opacity-60 text-left"
        >
          <span className="text-xl shrink-0" aria-hidden="true">
            &#x1F4F2;
          </span>
          <span>Open on This Device (Shared Phone)</span>
        </button>
      </div>

      {generating && (
        <p className="mt-2 text-xs text-center text-gray-400 dark:text-gray-500">
          Generating secure link...
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SetupComplete({ children }: SetupCompleteProps) {
  const firstName = children[0]?.name ?? 'Your child';

  return (
    <div>
      <div className="text-5xl text-center mb-3" aria-hidden="true">
        &#x1F389;
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-1">
        {children.length === 1
          ? `${firstName}'s account is ready!`
          : `All ${children.length} accounts are ready!`}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
        Now let&apos;s get{' '}
        {children.length === 1 ? firstName : 'them'} started on their device.
      </p>

      {children.map((child) => (
        <ChildSendCard key={child.id} child={child} />
      ))}

      <Link
        href="/parent/dashboard"
        className="mt-4 block w-full bg-[#534AB7] text-white text-center font-bold
          rounded-2xl py-4 min-h-[52px] hover:bg-[#4239a0] transition-colors"
      >
        Go to Dashboard
      </Link>
      <p className="mt-3 text-xs text-center text-gray-400 dark:text-gray-500">
        You can send the app link again anytime from your Parent Dashboard.
      </p>
    </div>
  );
}
