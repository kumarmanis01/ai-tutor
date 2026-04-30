import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireActiveSession } from '@/lib/auth';
import LandingPageInteractive from './landing-page/components/LandingPageInteractive';

export const metadata: Metadata = {
  title: 'AI Tutor India - Affordable 24×7 Homework Help in Hindi & English',
  description:
    "India's first AI-powered tutor providing instant homework help for classes 1-12. Get step-by-step solutions in Hindi and English for just ₹399/month. Works on any smartphone with 2GB RAM. Join 1 lakh+ students improving their grades.",
};

export default async function HomePage() {
  const session = await requireActiveSession();
  if (session) {
    const role = (session.user as any)?.role;
    // Existing parent: go straight to parent dashboard.
    if (role === 'parent') {
      redirect('/parent/dashboard');
    }
    // Student who completed onboarding: go to learning map.
    if ((session.user as any)?.onboardingComplete) {
      // redirect('/student/learning-map');
         redirect('/dashboard');
    }
  }
  return <LandingPageInteractive />;
}
