'use client';

/**
 * AiNarrativeWidget -- "Vidya's insight" section on the progress report page.
 *
 * Fetches /api/student/progress/narrative on mount and renders a 2-3 sentence
 * AI-generated summary of the student's last 30 days. Independent loading and
 * error states ensure one failing widget never blanks the whole page.
 *
 * PDF download is a placeholder -- shows "coming soon" toast (deferred feature).
 *
 * EDIT LOG:
 * - 2026-03-15 | claude | created for Task 29 progress report page
 * - 2026-05-13T00:00:00Z | copilot | migrate analytics emission to canonical analyticsClient + ANALYTICS_EVENTS constants
 */

import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import analyticsClient from '@/lib/analytics/client';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';

type State = 'loading' | 'error' | 'populated';

export default function AiNarrativeWidget({ initialNarrative }: { initialNarrative?: string | null }) {
  const [state, setState] = useState<State>(initialNarrative ? 'populated' : 'loading');
  const [narrative, setNarrative] = useState(initialNarrative ?? '');
  const [exporting, setExporting] = useState(false);
  const [exportDisabledUntil, setExportDisabledUntil] = useState<number | null>(null);

  const fetchNarrative = useCallback(async () => {
    // If server provided an initial narrative, skip client fetch to avoid duplicate calls
    if (initialNarrative) return;
    setState('loading');
    try {
      const res = await fetch('/api/student/progress/narrative');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { narrative?: string };
      if (!data.narrative) throw new Error('empty narrative');
      setNarrative(data.narrative);
      setState('populated');
    } catch {
      setState('error');
    }
  }, [initialNarrative]);

  useEffect(() => {
    void fetchNarrative();
  }, [fetchNarrative]);

  const insightCardClass =
    'flex gap-4 items-start rounded-2xl border border-[#AFA9EC] bg-[#EEEDFE] dark:bg-[#1A1845] dark:border-[#3A3580] p-5';

  if (state === 'loading') {
    return (
      <article
        className={insightCardClass}
        aria-busy="true"
        aria-label="Loading Teacher Vidya's insight"
      >
        {/* Avatar skeleton */}
        <div className="w-10 h-10 rounded-full bg-[#534AB7]/30 shrink-0 animate-pulse" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 w-24 bg-[#534AB7]/20 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-[#534AB7]/20 rounded animate-pulse" />
          <div className="h-4 w-full bg-[#534AB7]/20 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-[#534AB7]/20 rounded animate-pulse" />
        </div>
      </article>
    );
  }

  if (state === 'error') {
    return (
      <article className={insightCardClass}>
        {/* Avatar */}
        <VidyaAvatar />
        <p className="text-sm text-[#3C3489] dark:text-[#9B96E0]">
          {"Teacher Vidya will be right back. "}
          <button
            onClick={fetchNarrative}
            className="underline min-h-[44px] inline-flex items-center"
          >
            Please try again in a moment.
          </button>
        </p>
      </article>
    );
  }

  return (
    <article className={insightCardClass}>
      {/* Avatar */}
      <VidyaAvatar />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3C3489] dark:text-[#9B96E0]">
            {"Teacher Vidya's insight"}
          </span>
          <button
            onClick={async () => {
            if (exporting) return
            const now = Date.now()
            if (exportDisabledUntil && exportDisabledUntil > now) {
              toast('Please wait a moment before trying again.')
              return
            }
            setExporting(true)
            try {
              const res = await fetch('/api/student/progress/export')
              if (res.status === 429) {
                // Rate limited: set a short client-side cooldown
                const cooldownMs = 30_000
                setExportDisabledUntil(Date.now() + cooldownMs)
                toast('Too many exports. Please try again in 30 seconds.')
                analyticsClient.trackEvent({
                  eventType: ANALYTICS_EVENTS.STUDENT.EXPORT_PROGRESS_PDF,
                  metadata: { success: false, reason: 'rate_limited' },
                })
                return
              }

              if (!res.ok) {
                toast('Could not generate PDF. Please try again later.')
                analyticsClient.trackEvent({
                  eventType: ANALYTICS_EVENTS.STUDENT.EXPORT_PROGRESS_PDF,
                  metadata: { success: false, reason: `status_${res.status}` },
                })
                return
              }

              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'progress-report.pdf'
              document.body.appendChild(a)
              a.click()
              a.remove()
              URL.revokeObjectURL(url)

              analyticsClient.trackEvent({
                eventType: ANALYTICS_EVENTS.STUDENT.EXPORT_PROGRESS_PDF,
                metadata: { success: true, fileSize: blob.size ?? null },
              })
            } catch (err) {
              logger.error('Could not generate PDF (client)', { error: String(err) })
              toast('Could not generate PDF. Please try again later.')
              analyticsClient.trackEvent({
                eventType: ANALYTICS_EVENTS.STUDENT.EXPORT_PROGRESS_PDF,
                metadata: { success: false, reason: 'network_error' },
              })
            } finally {
              setExporting(false)
            }
          }}
          disabled={exporting || (exportDisabledUntil ? exportDisabledUntil > Date.now() : false)}
          className="min-h-[36px] px-3 inline-flex items-center gap-1.5 rounded-lg border border-[#AFA9EC] text-xs font-medium text-[#3C3489] dark:text-[#9B96E0] hover:bg-[#534AB7]/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
          aria-label="Download progress report as PDF"
        >
          {exporting ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                <path d="M22 12a10 10 0 0 1-10 10" strokeLinecap="round"></path>
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download PDF
            </>
          )}
        </button>
        </div>
        <p className="text-sm text-[#2C2C2A] dark:text-[#E6EEF8] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: narrative.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
        />
      </div>
    </article>
  );
}

function VidyaAvatar() {
  return (
    <div
      className="w-10 h-10 rounded-full bg-[#534AB7] text-white flex items-center justify-center shrink-0"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.4 4.3L18 8.6l-3.4 2.8L15.8 16 12 13.3 8.2 16l1.2-4.6L6 8.6l4.6-1.3z" />
      </svg>
    </div>
  );
}
