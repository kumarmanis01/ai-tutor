import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import RoleSelector from './RoleSelector';
import type { AppSession } from '@/lib/types/auth';

export default async function SelectRolePage() {
  const session = (await requireActiveSession()) as AppSession | null;

  if (!session) {
    redirect('/auth/signin?callbackUrl=/select-role');
  }

  if (session.user?.role === 'parent') {
    redirect('/parent/dashboard');
  }

  if (session.user?.onboardingComplete) {
    redirect('/dashboard');
  }

  return <RoleSelector />;
}
