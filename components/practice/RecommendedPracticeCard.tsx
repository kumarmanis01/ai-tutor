/**
 * FILE OBJECTIVE:
 * - Presentational card for the HomeEngine "practice" action.
 * - Pure props — no hooks, no fetch, no client directive.
 * - Rendered by the Practice page server component.
 *
 * EDIT LOG:
 * - 2026-02-22 | claude | created as server-friendly presentational component
 */
import Link from 'next/link';

export interface RecommendedPracticeCardProps {
  topicId: string;
  topicName?: string | null;
  subject?: string | null;
  chapter?: string | null;
  ruleId: string;
  reasonLabel: string;
  masteryLevel?: string | null;
  accuracy?: number | null;
}

export default function RecommendedPracticeCard({
  topicId,
  topicName,
  subject,
  chapter,
  reasonLabel,
  masteryLevel,
  accuracy,
}: RecommendedPracticeCardProps) {
  const href = `/practice/start?topicId=${encodeURIComponent(topicId)}`;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        Recommended Practice
      </p>

      <div className="space-y-1 mb-4">
        {subject && (
          <p className="text-sm text-muted-foreground capitalize">{subject}</p>
        )}
        {chapter && (
          <p className="text-sm text-muted-foreground capitalize">{chapter}</p>
        )}
        <h2 className="text-xl font-semibold text-foreground capitalize">
          {topicName ?? topicId}
        </h2>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {masteryLevel && (
            <span>
              Mastery:{' '}
              <span className="font-medium text-foreground capitalize">
                {masteryLevel}
              </span>
            </span>
          )}
          {typeof accuracy === 'number' && (
            <span>
              Accuracy:{' '}
              <span className="font-medium text-foreground">
                {Math.round(accuracy * 100)}%
              </span>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground italic">{reasonLabel}</p>
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
