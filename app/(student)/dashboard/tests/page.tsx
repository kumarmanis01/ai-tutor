import TestsTab from '@/app/(student)/dashboard/components/Tests';

export const metadata = { title: 'Practice – Spinzy Academy' };

export default function TestsPage() {
  // subject/grade/board default to empty strings; CascadingFilters inside
  // TestsTab auto-initialises from the user's profile via useProfileDefaults.
  return <TestsTab subject="" grade="" board="" />;
}
