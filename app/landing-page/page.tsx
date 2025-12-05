import type { Metadata } from 'next';
import LandingPageInteractive from './components/LandingPageInteractive';
import { getSessionUserWithSubscription } from '@/lib/session';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'AI Tutor India - Affordable 24×7 Homework Help in Hindi & English',
  description:
    "India's first AI-powered tutor providing instant homework help for classes 1-12. Get step-by-step solutions in Hindi and English for just ₹99/month. Works on any smartphone with 2GB RAM. Join 1 lakh+ students improving their grades.",
};

export default async function LandingPage() {
  // Server-side session check — redirect authenticated users to profile
  try {
    const { user } = await getSessionUserWithSubscription();
    if (user) {
      redirect('/profile');
    }
  } catch (e) {
    // If session check fails, fall back to rendering landing page
    console.warn('LandingPage: session check failed', e);
  }

  return <LandingPageInteractive />;
}
