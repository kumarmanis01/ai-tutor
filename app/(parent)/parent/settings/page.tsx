/**
 * Parent settings page -- allows parents to update weekly digest preferences.
 * Route: /parent/settings
 */

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { AppSession } from '@/lib/types/auth';
import ParentSettings from '@/components/parent/ParentSettings';

export default async function ParentSettingsPage() {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'parent') redirect('/dashboard');

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <ParentSettings />
    </main>
  );
}
