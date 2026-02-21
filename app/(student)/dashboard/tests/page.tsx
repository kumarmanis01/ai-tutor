/**
 * FILE OBJECTIVE:
 * - Practice page: recommended topic → resume session → performance snapshot → advanced filters.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | refactored layout per spec: Recommended + Resume + Performance + Filters
 */
import RecommendedPracticeCard from '@/components/practice/RecommendedPracticeCard';
import ResumePracticeCard from '@/components/practice/ResumePracticeCard';
import PerformanceSnapshot from '@/components/practice/PerformanceSnapshot';
import AdvancedPracticeFilters from '@/components/practice/AdvancedPracticeFilters';

export const metadata = { title: 'Practice – Spinzy Academy' };

export default function PracticePage() {
  return (
    <div className="space-y-6">
      <RecommendedPracticeCard />
      <ResumePracticeCard />
      <PerformanceSnapshot />
      <AdvancedPracticeFilters />
    </div>
  );
}
