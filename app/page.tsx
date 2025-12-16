import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUserWithSubscription } from '@/lib/session';
import LandingPageInteractive from '@/app/landing-page/components/LandingPageInteractive';

export const metadata: Metadata = {
  title: 'AI Tutor India - Affordable 24×7 Homework Help in Hindi & English',
  description:
    "India's first AI-powered tutor providing instant homework help for classes 1-12. Get step-by-step solutions in Hindi and English for just ₹99/month. Works on any smartphone with 2GB RAM. Join 1 lakh+ students improving their grades.",
};

export default async function HomePage() {
  const { user } = await getSessionUserWithSubscription();
  if (user) {
    redirect('/dashboard');
  }
  return <LandingPageInteractive />;
}
