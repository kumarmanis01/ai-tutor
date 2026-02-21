/**
 * FILE OBJECTIVE:
 * - Learning Goals sub-page within the student profile section.
 * - Renders the LearningGoalsCard for setting daily/weekly study targets.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created learning-goals sub-route extracted from profile page
 */
import Link from 'next/link';
import { LearningGoalsCard } from '@/app/(student)/dashboard/components/profile';

export const metadata = { title: 'Learning Goals – Spinzy Academy' };

export default function LearningGoalsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/dashboard/profile"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to Profile
      </Link>
      <LearningGoalsCard />
    </div>
  );
}
