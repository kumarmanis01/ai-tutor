'use client';

/**
 * ReferralShareCard -- F-STU-042 AC-01
 *
 * Fetches the student's unique referral code (/api/referral/create) and renders:
 * - Copy-to-clipboard button (AC-01)
 * - WhatsApp share button using the wa.me deep link (AC-01; no Business API required)
 *
 * Independent loading/error states -- one widget failing never blanks the page.
 * Never mentions "referral programme" by that name in user-facing copy (brand rule).
 */

import { useState, useEffect, useCallback } from 'react';

type State = 'loading' | 'error' | 'populated';

interface ReferralData {
  code: string;
  url: string;
}

export default function ReferralShareCard() {
  const [state, setState] = useState<State>('loading');
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchCode = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch('/api/referral/create', { method: 'POST' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { code?: string; url?: string };
      if (!json.code || !json.url) throw new Error('missing fields');
      setData({ code: json.code, url: json.url });
      setState('populated');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    void fetchCode();
  }, [fetchCode]);

  function handleCopy() {
    if (!data) return;
    const shareText = `Join me on Spinzy AI Tutor -- get 20% off your first month! Sign up here: ${data.url}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {});
    }
  }

  function whatsappUrl(): string {
    if (!data) return '#';
    const text = encodeURIComponent(
      `Join me on Spinzy AI Tutor -- get 20% off your first month! Sign up here: ${data.url}`,
    );
    return `https://wa.me/?text=${text}`;
  }

  if (state === 'loading') {
    return (
      <div
        className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5"
        aria-busy="true"
        aria-label="Loading invite link"
      >
        <div className="h-3 w-32 bg-gray-200 dark:bg-slate-600 rounded animate-pulse mb-3" />
        <div className="h-10 w-full bg-gray-200 dark:bg-slate-600 rounded-xl animate-pulse mb-3" />
        <div className="flex gap-3">
          <div className="h-11 flex-1 bg-gray-200 dark:bg-slate-600 rounded-xl animate-pulse" />
          <div className="h-11 flex-1 bg-gray-200 dark:bg-slate-600 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {"Couldn't load invite link."}{' '}
          <button
            onClick={fetchCode}
            className="underline text-[#534AB7] dark:text-[#9B96E0] min-h-[44px] inline-flex items-center"
          >
            Tap to retry.
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#534AB7]/20 bg-[#EEEDFE] dark:bg-[#534AB7]/10 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#534AB7] dark:text-[#9B96E0] mb-3">
        Invite a friend
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        Share your link. Your friend gets{' '}
        <span className="font-semibold text-[#534AB7]">20% off their first month</span>.
        You earn one month free when they subscribe.
      </p>

      {/* Referral code pill */}
      <div className="flex items-center gap-2 mb-4 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-[#534AB7]/20">
        <span className="flex-1 text-sm font-mono font-semibold text-gray-800 dark:text-gray-100 tracking-widest">
          {data!.code}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">Your invite code</span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Copy to clipboard -- AC-01 */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#534AB7] hover:bg-[#4338a3] text-white text-sm font-semibold px-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
          aria-label="Copy invite link to clipboard"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy invite link
            </>
          )}
        </button>

        {/* WhatsApp share -- AC-01 */}
        <a
          href={whatsappUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5a] text-white text-sm font-semibold px-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
          aria-label="Share invite link on WhatsApp"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Share on WhatsApp
        </a>
      </div>
    </div>
  );
}
