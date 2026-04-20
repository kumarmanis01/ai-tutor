"use client";
/**
 * FILE OBJECTIVE:
 * - Client-side component that fetches per-chapter practice test score history
 *   and renders the `ScoreTrendGraph`.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Test/ChapterTrend.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | created component for per-chapter trend (F-STU-020 AC-07)
 */

import React, { useEffect, useState } from 'react';
import ScoreTrendGraph, { type TrendPoint } from '@/components/student/progress/ScoreTrendGraph';

interface Props {
  chapter: string;
  subject?: string;
  className?: string;
  /** When true, show a skeleton loader while fetching instead of plain text */
  showSkeleton?: boolean;
}

export default function ChapterTrend({ chapter, subject, className = '', showSkeleton = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrendPoint[]>([]);

  useEffect(() => {
    let mounted = true;
    async function fetchTrend() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('chapter', chapter);
        if (subject) params.set('subject', subject);

        const res = await fetch(`/api/student/tests/trend?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load trend');

        const rows = Array.isArray(json?.data) ? json.data : [];
        const points: TrendPoint[] = rows.map((r: any) => ({ date: r.date, score: Math.round(r.score) }));
        if (mounted) setData(points);
      } catch (err: unknown) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchTrend();
    return () => {
      mounted = false;
    };
  }, [chapter, subject]);

  if (loading) {
    if (showSkeleton) {
      return (
        <div className={`animate-pulse space-y-2 ${className}`}>
          <div className="h-3 bg-gray-200 rounded w-1/3" />
          <div className="h-28 bg-gray-100 rounded" />
          <div className="flex gap-2">
            <div className="h-2 bg-gray-200 rounded w-1/4" />
            <div className="h-2 bg-gray-200 rounded w-1/4" />
            <div className="h-2 bg-gray-200 rounded w-1/4" />
          </div>
        </div>
      );
    }
    return <div className="text-sm text-muted-foreground">Loading trend...</div>;
  }

  if (error) return <div className="text-sm text-red-500">Could not load trend</div>;

  return (
    <div className={className}>
      <ScoreTrendGraph data={data} />
    </div>
  );
}
