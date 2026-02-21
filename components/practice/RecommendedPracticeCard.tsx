'use client';
/**
 * FILE OBJECTIVE:
 * - Shows the recommended practice topic with a one-click CTA.
 * - No filter selection required. Uses usePracticeRecommendation hook.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec
 */
import Link from 'next/link';
import { usePracticeRecommendation } from '@/hooks/usePracticeRecommendation';

export default function RecommendedPracticeCard() {
  const { recommendedTopicId, difficulty, lastAccuracy, questionCount, loading } =
    usePracticeRecommendation();

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-40 mb-3" />
        <div className="h-6 bg-muted rounded w-52 mb-4" />
        <div className="h-9 bg-muted rounded w-32" />
      </div>
    );
  }

  if (!recommendedTopicId) {
    return (
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="text-sm text-muted-foreground mb-1">No recommendation available</p>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-primary hover:underline"
        >
          Complete a topic to get a recommendation &rarr;
        </Link>
      </div>
    );
  }

  const href = `/practice/start?topicId=${encodeURIComponent(recommendedTopicId)}&difficulty=${encodeURIComponent(difficulty)}`;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        Recommended Practice
      </p>

      <div className="space-y-1 mb-4">
        <p className="text-base font-semibold text-foreground capitalize">{recommendedTopicId}</p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            Difficulty:{' '}
            <span className="font-medium text-foreground capitalize">{difficulty}</span>
          </span>
          <span>
            Questions:{' '}
            <span className="font-medium text-foreground">{questionCount}</span>
          </span>
          {lastAccuracy !== null && (
            <span>
              Last accuracy:{' '}
              <span className="font-medium text-foreground">{lastAccuracy}%</span>
            </span>
          )}
        </div>
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
