/**
 * FILE OBJECTIVE:
 * - Practice page driven by the deterministic HomeEngine via /api/home/next-action.
 * - Server Component — no client hooks for the hero section.
 * - actionType "practice" → RecommendedPracticeCard
 * - actionType "notes"    → guidance to complete lesson first
 * - null / other          → stable empty state
 * - Advanced filters remain below as a secondary option.
 *
 * EDIT LOG:
 * - 2026-02-22 | claude | rewired as server component driven by HomeEngine
 */
import Link from 'next/link';
import { cookies } from 'next/headers';
import RecommendedPracticeCard from '@/components/practice/RecommendedPracticeCard';
import TestsTab from '@/app/(student)/dashboard/components/Tests';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Practice – Spinzy Academy' };

async function fetchNextAction() {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/home/next-action`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.action ?? null;
  } catch {
    return null;
  }
}

export default async function PracticePage() {
  const action = await fetchNextAction();

  return (
    <div className="space-y-6 px-3 sm:px-4 py-4">
      {/* Hero section — deterministic, driven by HomeEngine */}
      {action?.actionType === 'practice' && action.topicId ? (
        <RecommendedPracticeCard
          topicId={action.topicId}
          topicName={action.topicName ?? null}
          subject={action.subject ?? null}
          chapter={action.chapter ?? null}
          ruleId={action.ruleId}
          reasonLabel={action.reasonLabel}
          masteryLevel={action.masteryLevel ?? null}
          accuracy={action.accuracy ?? null}
        />
      ) : action?.actionType === 'notes' ? (
        <section aria-label="Lesson guidance">
          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Next Step
            </p>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Complete the lesson first
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              You need to complete the lesson before practicing.
            </p>
            {action.topicId && (
              <Link
                href={`/learn/${encodeURIComponent(action.topicId)}`}
                className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors"
              >
                Go to Lesson &rarr;
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section aria-label="No practice needed">
          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Practice
            </p>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              No practice required right now.
            </h2>
            <p className="text-sm text-muted-foreground">
              Check back after completing your next lesson or when new topics are available.
            </p>
          </div>
        </section>
      )}

      {/* Existing tests/filters section — secondary */}
      <TestsTab subject="" grade="" board="" />
    </div>
  );
}
