/**
 * FILE OBJECTIVE:
 * - A4.1: MetricCard — displays a single analytics KPI with value,
 *   trend indicator (+/-%), and an optional bar sparkline.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/analytics/MetricCard.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A4.1 MetricCard component
 */

import React from 'react';

type MetricCardProps = {
  label: string;
  value: number;
  suffix?: string;
  trend?: string | null;
  /** Optional array of 7 relative values (0-100) for sparkline bars */
  sparkline?: number[];
};

function TrendBadge({ trend }: { trend: string }) {
  const isPositive = trend.startsWith('+');
  const isNeutral = trend === '0%';
  const colour = isNeutral
    ? 'bg-gray-100 text-gray-500'
    : isPositive
    ? 'bg-[#EAF3DE] text-[#1D9E75]'
    : 'bg-[#FCEBEB] text-[#E24B4A]';
  const arrow = isNeutral ? '→' : isPositive ? '↑' : '↓';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${colour}`}>
      {arrow} {trend}
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mt-3 flex h-8 items-end gap-0.5" aria-hidden="true">
      {values.map((v, idx) => {
        const pct = Math.round((v / max) * 100);
        return (
          // eslint-disable-next-line react/no-array-index-key
          <div
            key={idx}
            className="flex-1 rounded-t bg-[#534AB7]/40"
            style={{ height: `${Math.max(pct, 8)}%` }}
          />
        );
      })}
    </div>
  );
}

/**
 * A4.1 — KPI card with trend and sparkline.
 */
export function MetricCard({ label, value, suffix, trend, sparkline }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-3xl font-bold tabular-nums text-gray-900">
          {value.toLocaleString('en-IN')}
        </span>
        {suffix && <span className="mb-1 text-lg font-semibold text-gray-400">{suffix}</span>}
      </div>
      {trend != null && (
        <div className="mt-2">
          <TrendBadge trend={trend} />
          <span className="ml-2 text-xs text-gray-400">vs prev period</span>
        </div>
      )}
      {sparkline && sparkline.length > 0 && <Sparkline values={sparkline} />}
    </div>
  );
}

export default MetricCard;
