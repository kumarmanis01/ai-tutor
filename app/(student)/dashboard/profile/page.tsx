import { LearningGoalsCard } from '@/app/(student)/dashboard/components/profile';

export const metadata = { title: 'Profile – Spinzy Academy' };

export default function ProfilePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <LearningGoalsCard />
    </div>
  );
}
