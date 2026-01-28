import type { Metadata } from 'next';
import StudentHomeDashboard from './components/StudentHomeDashboard';
import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'AI Tutor - Student Dashboard | Your Learning Hub',
  description: 'Access personalized learning content, solve doubts instantly, practice tests, and track your progress. Designed for Tier-2/3/4 Indian students.',
};

export default async function StudentHomeDashboardPage() {
  const session = await requireActiveSession();
  if (!session) {
    // Redirect to root if no active session found
    redirect(`/`);
  }

  return <StudentHomeDashboard />;
}
