'use client';
/**
 * FILE OBJECTIVE:
 * - Shows the student's last 3 recently accessed topics with links to open notes.
 * - Uses /api/dashboard/continue-learning (LearningSession records).
 * - Hidden entirely if no activity exists.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RecentTopic {
  id: string;
  title: string;
  subject?: string;
  lastAccessedAt: string;
  contentId?: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function RecentTopicsSection() {
  const [topics, setTopics]   = useState<RecentTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/continue-learning')
      .then((r) => r.json())
      .then((data) => {
        const activities = Array.isArray(data?.activities) ? data.activities : [];
        const mapped: RecentTopic[] = activities
          .filter((a: any) => a.activityType === 'notes' || a.activityType === 'lesson')
          .slice(0, 3)
          .map((a: any) => ({
            id: a.id,
            title: a.title ?? a.contentId ?? 'Untitled topic',
            subject: a.subject,
            lastAccessedAt: a.startedAt ?? '',
            contentId: a.contentId,
          }));
        setTopics(mapped);
      })
      .catch(() => setTopics([]))
      .finally(() => setLoading(false));
  }, []);

  // Hide completely if still loading or no activity
  if (loading || topics.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold text-foreground mb-3">Recently Accessed</h2>
      <ul className="divide-y divide-border">
        {topics.map((t) => (
          <li key={t.id} className="py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
              <p className="text-xs text-muted-foreground">
                {t.subject && <span className="capitalize">{t.subject} · </span>}
                {t.lastAccessedAt && formatDate(t.lastAccessedAt)}
              </p>
            </div>
            <Link
              href={`/learn/${encodeURIComponent(t.contentId ?? t.id)}`}
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Open &rarr;
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
