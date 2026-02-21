import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import LandingPageInteractive from './landing-page/components/LandingPageInteractive';

export const metadata: Metadata = {
  title: 'AI Tutor India - Affordable 24×7 Homework Help in Hindi & English',
  description:
    "India's first AI-powered tutor providing instant homework help for classes 1-12. Get step-by-step solutions in Hindi and English for just ₹99/month. Works on any smartphone with 2GB RAM. Join 1 lakh+ students improving their grades.",
};

export default async function HomePage() {
  const session = await requireActiveSession();
  // Only redirect to dashboard when the user has a fully active session
  // and has completed onboarding. Keep the landing page session-agnostic
  // for users who are mid-onboarding so the onboarding modal does not
  // render on the public landing page.
  if (session && (session.user as any)?.onboardingComplete) {
    redirect('/dashboard');
  }
  return <LandingPageInteractive />;
}
