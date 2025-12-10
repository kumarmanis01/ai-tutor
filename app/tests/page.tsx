import QuickPractice from '@/components/Test/QuickPractice';
import ChapterTests from '@/components/Test/ChapterTests';
import WeeklyChallenge from '@/components/Test/WeeklyChallenge';
import TestHistory from '@/components/Test/TestHistory';

/**
 * /tests page
 *
 * Modular Test tab composed from small components following project conventions.
 * This page can later be embedded inside dashboard tabs.
 */
export default function TestsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <QuickPractice subject="Math" questionCount={8} />
      <ChapterTests subject="Math" />
      <TestHistory />
      <WeeklyChallenge />
    </div>
  );
}
