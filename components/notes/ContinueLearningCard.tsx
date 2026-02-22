'use client';
/**
 * FILE OBJECTIVE:
 * - Displays the student's current recommended learning topic (notes only).
 * - Renders only when actionType === "notes". Returns null for practice actions.
 * - CTA → /learn/[topicId]
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec
 * - 2026-02-21 | claude | wired to useNextAction (deterministic engine)
 */
import Link from 'next/link';
import { useNextAction } from '@/hooks/useNextAction';

export default function ContinueLearningCard() {
  const { action, isLoading } = useNextAction();

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-40 mb-3" />
        <div className="h-6 bg-muted rounded w-60 mb-2" />
        <div className="h-4 bg-muted rounded w-32" />
      </div>
    );
  }

  // Only render for notes actions
  if (!action || action.actionType !== 'notes') return null;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        Continue Learning
      </p>

      <div className="space-y-1 mb-4">
        {action.subject && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Subject:</span>{' '}
            <span className="capitalize">{action.subject}</span>
          </p>
        )}
        {action.chapter && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Chapter:</span>{' '}
            <span className="capitalize">{action.chapter}</span>
          </p>
        )}
        <p className="text-base font-semibold text-foreground capitalize">
          {action.topicId}
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        {action.estimatedTimeMin && (
          <span>
            Est. time:{' '}
            <span className="font-medium text-foreground">{action.estimatedTimeMin} min</span>
          </span>
        )}
        {typeof action.accuracy === 'number' && action.accuracy > 0 && (
          <span>
            Accuracy:{' '}
            <span className="font-medium text-foreground">
              {Math.round(action.accuracy * 100)}%
            </span>
          </span>
        )}
        <span className="text-xs text-muted-foreground italic">{action.reasonLabel}</span>
      </div>

      <Link
        href={`/learn/${encodeURIComponent(action.topicId ?? '')}`}
        className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors"
      >
        Open Notes &rarr;
      </Link>
    </div>
  );
}
