/**
 * FILE OBJECTIVE:
 * - Public landing page. Routes authenticated users onward: active + onboarding
 *   complete -> /dashboard; logged in but not yet active -> /student/onboarding;
 *   otherwise renders the marketing landing page.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/public/page.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-06-06T00:00:00Z | claude | use raw getServerSession so mid-onboarding users route to
 *     /student/onboarding instead of being stranded on the landing page; add standard header
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import LandingPageInteractive from './landing-page/components/LandingPageInteractive';

export const metadata: Metadata = {
  title: 'AI Tutor India - Affordable 24×7 Homework Help in Hindi & English',
  description:
    "India's first AI-powered tutor providing instant homework help for classes 1-12. Get step-by-step solutions in Hindi and English for just ₹399/month. Works on any smartphone with 2GB RAM. Join 1 lakh+ students improving their grades.",
};

export default async function HomePage() {
  // Use raw getServerSession (not requireActiveSession) so we can detect
  // mid-onboarding users whose accountStatus is still pending_*. Those users
  // have a valid JWT but requireActiveSession returns null for them, which
  // previously left them stuck on the landing page after Google sign-in.
  const session = (await getServerSession(authOptions)) as
    | { user?: { onboardingComplete?: boolean; accountStatus?: string } }
    | null;

  if (session?.user) {
    const onboardingComplete = !!session.user.onboardingComplete;
    const accountStatus = session.user.accountStatus ?? 'active';
    if (accountStatus === 'active' && onboardingComplete) {
      redirect('/dashboard');
    }
    // Logged in but not yet active -- send to onboarding so they finish the flow
    // instead of bouncing on the public landing page.
    redirect('/student/onboarding');
  }

  return <LandingPageInteractive />;
}
