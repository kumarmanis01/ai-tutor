'use client';

/**
 * HeroReadinessBand -- overall readiness ring + AI headline + week momentum.
 *
 * Matches the wireframe hero section:
 *   [ring + tier] | [headline + focus chips] | [week dots + streak]
 * Stacks to 1-col at <640px (mobile-first).
 */

import { TIER_FILLS, TIER_CHIP } from '@/lib/theme/progressTokens';

export interface HeroData {
  overallPct: number;
  tier: 'critical' | 'weak' | 'fair' | 'ontrack' | 'strong';
  tierLabel: string;
  headline: string;
  summary: string;
  strongestChapter: string | null;
  weakestChapter: string | null;
  weekDots: ('done' | 'today' | 'future')[];
  currentStreak: number;
  bestStreak: number;
}

const CIRCUMFERENCE = 2 * Math.PI * 52; // r=52, same as wireframe

export default function HeroReadinessBand({ data }: { data: HeroData }) {
  const fill = TIER_FILLS[data.tier] ?? '#534AB7';
  const dashOffset = CIRCUMFERENCE * (1 - data.overallPct / 100);

  return (
    <section className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-5 bg-white dark:bg-slate-900 border border-[#D3D1C7] dark:border-slate-700 rounded-2xl p-5 mb-6">

      {/* ── Ring ── */}
      <div className="flex flex-col items-center gap-1 sm:items-start">
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#888780] dark:text-[#6B7280]">
          Overall readiness
        </span>
        <div className="relative w-[90px] h-[90px] mx-auto sm:mx-0">
          <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true">
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="#D3D1C7"
              strokeWidth="12"
            />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke={fill}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[13px] font-semibold"
              style={{ color: fill }}
            >
              {data.tierLabel}
            </span>
            <span className="text-[11px] text-[#888780] dark:text-[#6B7280] tabular-nums">
              {data.overallPct}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Headline + focus chips ── */}
      <div className="flex flex-col gap-2 justify-center">
        <h2 className="text-base font-semibold leading-snug text-[#2C2C2A] dark:text-[#E6EEF8]">
          {data.headline}
        </h2>
        <p className="text-sm text-[#5F5E5A] dark:text-[#9AA6B2] leading-relaxed">
          {data.summary}
        </p>
        <div className="flex flex-wrap gap-2 mt-1">
          {data.strongestChapter && (
            <span className={`inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-0.5 rounded-full border ${TIER_CHIP.strong}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Strongest: {data.strongestChapter}
            </span>
          )}
          {data.weakestChapter && (
            <span className={`inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-0.5 rounded-full border ${TIER_CHIP.weak}`}>
              Focus next: {data.weakestChapter}
            </span>
          )}
        </div>
      </div>

      {/* ── Momentum / week dots ── */}
      <div className="flex flex-col items-start sm:items-end gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#888780] dark:text-[#6B7280]">
          This week
        </span>
        <div className="flex gap-2">
          {data.weekDots.map((state, i) => (
            <WeekDot key={i} state={state} />
          ))}
        </div>
        <span className="text-[13px] text-[#5F5E5A] dark:text-[#9AA6B2]">
          <strong className="text-[#2C2C2A] dark:text-[#E6EEF8]">{data.currentStreak}-day</strong> streak
          {data.bestStreak > 0 && (
            <> &middot; best {data.bestStreak}</>
          )}
        </span>
      </div>
    </section>
  );
}

function WeekDot({ state }: { state: 'done' | 'today' | 'future' }) {
  if (state === 'done') {
    return (
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center bg-[#1D9E75]"
        style={{ boxShadow: '0 3px 0 #176A4F' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (state === 'today') {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 border-2 border-[#534AB7]"
        style={{ boxShadow: '0 3px 0 #3A2F8C' }}
      >
        <div className="w-2 h-2 rounded-full bg-[#534AB7]" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full border border-dashed border-[#D3D1C7] dark:border-slate-600" />
  );
}
