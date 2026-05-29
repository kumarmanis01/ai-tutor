'use client';

/**
 * ProgressMetricCard -- single card in the 4-metric row on the progress page.
 *
 * Layout matches the wireframe metric card:
 *   eyebrow + optional delta badge (top row)
 *   large mono value
 *   caption subtitle
 *   optional sparkline bar strip (bottom)
 */

import { CARD_CLASS } from '@/lib/theme/progressTokens';

export interface MetricCardData {
  eyebrow: string;
  value: string;
  caption: string;
  delta?: React.ReactNode;
  sparkBars?: number[];
  highlight?: boolean;
  highlightColor?: string;
}

export default function ProgressMetricCard({
  eyebrow,
  value,
  caption,
  delta,
  sparkBars,
  highlight,
  highlightColor = '#1D9E75',
}: MetricCardData) {
  return (
    <article
      className={`${CARD_CLASS} flex flex-col gap-1 min-h-[112px]`}
      style={highlight ? { borderColor: `${highlightColor}4D` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#888780] dark:text-[#6B7280]">
          {eyebrow}
        </span>
        {delta && <span className="text-xs shrink-0">{delta}</span>}
      </div>

      <p
        className="font-mono text-3xl font-semibold tracking-tight leading-none text-[#2C2C2A] dark:text-[#E6EEF8] mt-0.5"
        style={highlight ? { color: highlightColor } : undefined}
      >
        {value}
      </p>

      <p className="text-xs text-[#888780] dark:text-[#6B7280] mt-0.5">{caption}</p>

      {sparkBars && sparkBars.length > 0 && (
        <SparkBars values={sparkBars} color={highlightColor} />
      )}
    </article>
  );
}

function SparkBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[3px] h-7 mt-1" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-[2px] min-h-[3px]"
          style={{
            height: `${Math.max(3, Math.round((v / max) * 28))}px`,
            background: color,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}
