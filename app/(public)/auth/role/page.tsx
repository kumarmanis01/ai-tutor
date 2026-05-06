/**
 * FILE OBJECTIVE:
 * - Server component wrapper for /auth/role.
 * - Reads the session server-side and immediately redirects existing users
 *   to their dashboard (student -> /dashboard or /student/onboarding,
 *   parent -> /parent/dashboard, admin/moderator -> /admin).
 * - Only brand-new users (role = 'user', set by NextAuth on first sign-in)
 *   are shown the RoleSelector client component.
 * - This approach eliminates the client-side flash that occurred when the
 *   previous fully-client component redirected via router.replace().
 *
 * LINKED UNIT TEST: none (redirect logic depends on getServerSession)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-05 | staff-engineer | created as client component for post-auth role selection
 * - 2026-05-06 | claude | converted to server component; existing users redirected server-side
 */

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { AppSession } from '@/lib/types/auth';
import RoleSelector from './RoleSelector';

export default async function RoleSelectionPage() {
  const session = (await getServerSession(authOptions)) as AppSession | null;

  if (!session?.user?.id) {
    redirect('/auth/signup');
  }

  const role = session.user.role ?? 'user';
  const onboardingComplete = session.user.onboardingComplete ?? false;
  const accountStatus = session.user.accountStatus ?? 'active';

  // Existing student: go to onboarding if not complete, dashboard otherwise.
  // pending_parent_verification stays on the onboarding page until OTP is done.
  if (role === 'student') {
    if (!onboardingComplete || accountStatus === 'pending_parent_verification') {
      redirect('/student/onboarding');
    }
    redirect('/dashboard');
  }

  if (role === 'parent') {
    redirect('/parent/dashboard');
  }

  if (role === 'admin' || role === 'moderator') {
    redirect('/admin');
  }

  // role === 'user' -- brand-new account, no role chosen yet
  return <RoleSelector />;
}
