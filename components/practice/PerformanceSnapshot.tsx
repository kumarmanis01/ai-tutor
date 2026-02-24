'use client';
/**
 * FILE OBJECTIVE:
 * - Lightweight performance snapshot: last 5 attempts, accuracy %, weak topics.
 * - No charts. Hidden if no data available.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec
 */
import { useEffect, useState } from 'react';

interface Attempt {
  id: string;
  testId: string;
  score: number | null;
  date: string;
}

interface PerformanceData {
  attempts: Attempt[];
  accuracyPercent: number | null;
  weakTopics: string[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function PerformanceSnapshot() {
  const [data, setData]     = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/student/performance-summary')
      .then((r) => r.json())
      .then((d: PerformanceData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-40 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-muted rounded" />)}
        </div>
      </div>
    );
  }

  if (!data || data.attempts.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Performance Snapshot</h2>
        {data.accuracyPercent !== null && (
          <span className="text-sm font-medium text-foreground">
            Avg accuracy:{' '}
            <span className="text-primary">{data.accuracyPercent}%</span>
          </span>
        )}
      </div>

      {/* Last 5 attempts */}
      <div className="mb-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Last 5 Attempts</p>
        <ul className="divide-y divide-border">
          {data.attempts.map((a) => (
            <li key={a.id} className="py-2 flex items-center justify-between text-sm">
              <span className="text-foreground truncate max-w-[60%]">{a.testId}</span>
              <span className="flex items-center gap-3 text-muted-foreground shrink-0">
                {a.score !== null && (
                  <span className="font-medium text-foreground">{a.score}%</span>
                )}
                <span>{formatDate(a.date)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Weak topics */}
      {data.weakTopics.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Needs Attention</p>
          <div className="flex flex-wrap gap-1">
            {data.weakTopics.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive capitalize"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
