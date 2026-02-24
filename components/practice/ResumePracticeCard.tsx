'use client';
/**
 * FILE OBJECTIVE:
 * - Shows the most recent in-progress practice session with a Resume CTA.
 * - Hidden entirely if no in-progress session exists.
 * - Uses /api/dashboard/continue-learning (LearningSession with isCompleted=false).
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface InProgressSession {
  id: string;
  title?: string;
  subject?: string;
  completionPercentage?: number;
}

export default function ResumePracticeCard() {
  const [session, setSession]   = useState<InProgressSession | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/continue-learning')
      .then((r) => r.json())
      .then((data) => {
        const activities = Array.isArray(data?.activities) ? data.activities : [];
        // Find first practice/test in-progress session
        const found = activities.find(
          (a: any) => a.activityType === 'practice' || a.activityType === 'test'
        ) ?? null;

        if (found) {
          setSession({
            id: found.id,
            title: found.title,
            subject: found.subject,
            completionPercentage: found.completionPercentage,
          });
        }
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  // Hidden while loading or no in-progress session
  if (loading || !session) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        Resume Practice
      </p>

      <div className="space-y-1 mb-4">
        {session.title && (
          <p className="text-base font-semibold text-foreground">{session.title}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {session.subject && (
            <span className="capitalize">{session.subject}</span>
          )}
          {session.completionPercentage != null && session.completionPercentage > 0 && (
            <span>{session.completionPercentage}% complete</span>
          )}
        </div>
      </div>

      <Link
        href={`/practice/session/${encodeURIComponent(session.id)}`}
        className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors"
      >
        Resume &rarr;
      </Link>
    </div>
  );
}
