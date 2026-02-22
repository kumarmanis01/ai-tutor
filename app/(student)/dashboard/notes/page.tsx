/**
 * FILE OBJECTIVE:
 * - Notes page: hero recommendation → browse by subject/chapter/topic → recent activity.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | refactored layout per spec: ContinueLearning + Browse + Recent
 * - 2026-02-22 | claude | server-side hero using enriched NextAction metadata
 */
import Link from 'next/link';
import BrowseNotesSection from '@/components/notes/BrowseNotesSection';
import RecentTopicsSection from '@/components/notes/RecentTopicsSection';

export const metadata = { title: 'Notes – Spinzy Academy' };

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

export default async function NotesPage() {
  const action = await fetchNextAction();
  const showHero = action && action.actionType === 'notes';

  return (
    <div className="space-y-6">
      {showHero && (
        <section aria-label="Continue Learning">
          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Continue Learning
            </p>

            <h2 className="text-xl font-semibold text-foreground mb-1">
              {(action.topicName as string) ?? '—'}
            </h2>

            {(action.subject || action.chapter) && (
              <p className="text-sm text-muted-foreground mb-1">
                {[action.subject, action.chapter].filter(Boolean).join(' • ')}
              </p>
            )}

            {action.reasonLabel && (
              <p className="text-xs text-muted-foreground italic mb-4">
                {action.reasonLabel as string}
              </p>
            )}

            <Link
              href={`/learn/${encodeURIComponent((action.topicId as string) ?? '')}`}
              className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors"
            >
              Open Notes &rarr;
            </Link>
          </div>
        </section>
      )}

      <BrowseNotesSection />
      <RecentTopicsSection />
    </div>
  );
}
