import type { Metadata } from 'next';
import StudentHomeDashboard from './components/StudentHomeDashboard';

export const metadata: Metadata = {
  title: 'AI Tutor - Student Dashboard | Your Learning Hub',
  description: 'Access personalized learning content, solve doubts instantly, practice tests, and track your progress. Designed for Tier-2/3/4 Indian students.',
};

export default function StudentHomeDashboardPage() {
  return <StudentHomeDashboard />;
}
