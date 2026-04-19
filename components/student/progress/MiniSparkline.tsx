"use client";
/**
 * MiniSparkline
 *
 * Compact inline sparkline used on chapter cards to show recent score trend
 * and the last score percentage. Fetches the same API as `ChapterTrend`
 * but renders a small, low-detail SVG suitable for tight UI contexts.
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | created mini sparkline for chapter cards (phase-2)
 */
import React, { useEffect, useState } from 'react';
import type { TrendPoint } from '@/components/student/progress/ScoreTrendGraph';

const PRIMARY = '#534AB7';
const GRID = '#E5E7EB';

export default function MiniSparkline({
  chapter,
  subject,
  className = '',
  trendData,
}: {
  chapter: string;
  subject?: string;
  className?: string;
  /** optional pre-fetched data to avoid per-sparkline requests */
  trendData?: TrendPoint[];
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrendPoint[]>([]);

  useEffect(() => {
    if (trendData) return; // caller provided data, skip fetch
    let mounted = true;
    async function run() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('chapter', chapter);
        if (subject) params.set('subject', subject);
        const res = await fetch(`/api/student/tests/trend?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed');
        const rows = Array.isArray(json?.data) ? json.data : [];
        const points: TrendPoint[] = rows.map((r: any) => ({ date: r.date, score: Math.round(r.score) }));
        if (mounted) setData(points);
      } catch (err) {
        if (!mounted) return;
        setData([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [chapter, subject, trendData]);

  const effective = trendData ?? data;
  const n = effective.length;
  // tiny canvas
  const W = 120;
  const H = 28;
  const PAD_LEFT = 6;
  const PAD_RIGHT = 6;
  const INNER_W = W - PAD_LEFT - PAD_RIGHT;
  const toX = (i: number) => PAD_LEFT + (n > 1 ? (i / (n - 1)) * INNER_W : INNER_W / 2);
  const toY = (score: number) => H - 6 - (Math.max(0, Math.min(100, score)) / 100) * (H - 12);

  const points = effective.map((d, i) => `${toX(i).toFixed(1)},${toY(d.score).toFixed(1)}`).join(' ');
  const lastScore = n ? effective[n - 1].score : null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="w-[120px] h-[28px]" aria-hidden="false">
        {n === 0 ? (
          <svg viewBox={`0 0 ${W} ${H}`} width="120" height="28" role="img" aria-label="No recent scores">
            <rect x={0} y={0} width={W} height={H} fill="#F8FAFC" />
          </svg>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} width="120" height="28" role="img" aria-label={`Score trend, last ${n} attempts`}>
            <line x1={PAD_LEFT} y1={H - 6} x2={W - PAD_RIGHT} y2={H - 6} stroke={GRID} strokeWidth={1} />
            {n > 1 && (
              <polyline points={points} fill="none" stroke={PRIMARY} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {effective.map((d, i) => (
              <circle key={`s-${i}`} cx={toX(i)} cy={toY(d.score)} r={2.2} fill={PRIMARY} />
            ))}
          </svg>
        )}
      </div>
      <div className="text-xs text-gray-600">
        {loading ? '...' : lastScore !== null ? `Last: ${lastScore}%` : 'No score'}
      </div>
    </div>
  );
}
