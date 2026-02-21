'use client';
/**
 * FILE OBJECTIVE:
 * - Displays the student's current recommended learning topic.
 * - Shows subject, chapter, topic, difficulty, estimated time with a CTA to /learn/[topicId].
 * - If no recommendation exists, shows a "Start Your Learning Path" CTA to /dashboard.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec
 */
import Link from 'next/link';
import { useLearningRecommendation } from '@/hooks/useLearningRecommendation';

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export default function ContinueLearningCard() {
  const { currentTopic, progressPercent, loading } = useLearningRecommendation();

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-40 mb-3" />
        <div className="h-6 bg-muted rounded w-60 mb-2" />
        <div className="h-4 bg-muted rounded w-32" />
      </div>
    );
  }

  if (!currentTopic) {
    return (
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="text-sm text-muted-foreground mb-1">No active recommendation</p>
        <h2 className="text-base font-semibold text-foreground mb-3">Start Your Learning Path</h2>
        <Link
          href="/dashboard"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          Go to Dashboard &rarr;
        </Link>
      </div>
    );
  }

  const { subjectId, chapterId, topicId, difficulty, estimatedTime } = currentTopic;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        Continue Learning
      </p>

      <div className="space-y-1 mb-4">
        {subjectId && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Subject:</span>{' '}
            <span className="capitalize">{subjectId}</span>
          </p>
        )}
        {chapterId && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Chapter:</span>{' '}
            <span className="capitalize">{chapterId}</span>
          </p>
        )}
        <p className="text-base font-semibold text-foreground capitalize">{topicId}</p>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <span>
          Difficulty:{' '}
          <span className="font-medium text-foreground">{DIFFICULTY_LABEL[difficulty]}</span>
        </span>
        <span>
          Est. time:{' '}
          <span className="font-medium text-foreground">{estimatedTime} min</span>
        </span>
        {progressPercent > 0 && (
          <span>
            Progress:{' '}
            <span className="font-medium text-foreground">{progressPercent}%</span>
          </span>
        )}
      </div>

      <Link
        href={`/learn/${encodeURIComponent(topicId)}`}
        className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors"
      >
        Open Notes &rarr;
      </Link>
    </div>
  );
}
