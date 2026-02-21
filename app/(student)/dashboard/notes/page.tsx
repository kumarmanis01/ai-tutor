/**
 * FILE OBJECTIVE:
 * - Notes page: hero recommendation → browse by subject/chapter/topic → recent activity.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | refactored layout per spec: ContinueLearning + Browse + Recent
 */
import ContinueLearningCard from '@/components/notes/ContinueLearningCard';
import BrowseNotesSection from '@/components/notes/BrowseNotesSection';
import RecentTopicsSection from '@/components/notes/RecentTopicsSection';

export const metadata = { title: 'Notes – Spinzy Academy' };

export default function NotesPage() {
  return (
    <div className="space-y-6">
      <ContinueLearningCard />
      <BrowseNotesSection />
      <RecentTopicsSection />
    </div>
  );
}
