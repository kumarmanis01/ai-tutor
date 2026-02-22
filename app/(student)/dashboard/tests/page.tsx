/**
 * FILE OBJECTIVE:
 * - Practice page: recommended topic → resume session → performance snapshot → advanced filters.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | refactored layout per spec: Recommended + Resume + Performance + Filters
 * - 2026-02-22 | claude | server-side hero using enriched NextAction metadata
 */
import Link from 'next/link';
import ResumePracticeCard from '@/components/practice/ResumePracticeCard';
import PerformanceSnapshot from '@/components/practice/PerformanceSnapshot';
import AdvancedPracticeFilters from '@/components/practice/AdvancedPracticeFilters';

export const metadata = { title: 'Practice – Spinzy Academy' };

async function fetchNextAction(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('/api/home/next-action', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.action ?? null;
  } catch {
    return null;
  }
}

export default async function PracticePage() {
  const action = await fetchNextAction();
  const showHero = action && action.actionType === 'practice';

  return (
    <div className="space-y-6">
      {showHero && (
        <section aria-label="Recommended Practice">
          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Recommended Practice
            </p>

            <h2 className="text-xl font-semibold text-foreground mb-1">
              {(action.topicName as string) ?? '—'}
            </h2>

            {action.reasonLabel && (
              <p className="text-sm text-muted-foreground italic mb-4">
                {action.reasonLabel as string}
              </p>
            )}

            <Link
              href={`/practice/start?topicId=${encodeURIComponent((action.topicId as string) ?? '')}`}
              className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors"
            >
              Start Practice &rarr;
            </Link>
          </div>
        </section>
      )}

      <ResumePracticeCard />
      <PerformanceSnapshot />
      <AdvancedPracticeFilters />
    </div>
  );
}
