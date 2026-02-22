'use client';
/**
 * FILE OBJECTIVE:
 * - Shows the recommended practice topic with a one-click CTA.
 * - Renders only when actionType === "practice". Returns null otherwise.
 * - CTA → /practice/start?topicId=X
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec
 * - 2026-02-21 | claude | wired to useNextAction (deterministic engine)
 */
import Link from 'next/link';
import { useNextAction } from '@/hooks/useNextAction';

export default function RecommendedPracticeCard() {
  const { action, isLoading } = useNextAction();

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-40 mb-3" />
        <div className="h-6 bg-muted rounded w-52 mb-4" />
        <div className="h-9 bg-muted rounded w-32" />
      </div>
    );
  }

  // Only render for practice actions
  if (!action || action.actionType !== 'practice') return null;

  const href = `/practice/start?topicId=${encodeURIComponent(action.topicId ?? '')}`;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        Recommended Practice
      </p>

      <div className="space-y-1 mb-4">
        {action.subject && (
          <p className="text-sm text-muted-foreground capitalize">{action.subject}</p>
        )}
        {action.chapter && (
          <p className="text-sm text-muted-foreground capitalize">{action.chapter}</p>
        )}
        <p className="text-base font-semibold text-foreground capitalize">
          {action.topicId}
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {action.masteryLevel && (
            <span>
              Mastery:{' '}
              <span className="font-medium text-foreground capitalize">{action.masteryLevel}</span>
            </span>
          )}
          {typeof action.accuracy === 'number' && (
            <span>
              Accuracy:{' '}
              <span className="font-medium text-foreground">
                {Math.round(action.accuracy * 100)}%
              </span>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground italic">{action.reasonLabel}</p>
      </div>

      <Link
        href={href}
        className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors"
      >
        Start Practice &rarr;
      </Link>
    </div>
  );
}
