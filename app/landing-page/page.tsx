import type { Metadata } from 'next';
import { logger } from '@/lib/logger';
import LandingPageInteractive from './components/LandingPageInteractive';
import { getSessionUserWithSubscription } from '@/lib/session';
import { redirect } from 'next/navigation';
import React from 'react';

function ClientReplace({ to }: { to: string }) {
  'use client';
  React.useEffect(() => {
    try { window.location.replace(to); } catch {}
  }, [to]);
  return null;
}

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
      return <ClientReplace to="/dashboard" />;
    }
  } catch (e) {
    // If this is Next.js' redirect control-flow we must rethrow it
    // so Next can perform the redirect. Otherwise log and fall back
    // to rendering the landing page.
    try {
      const maybe = e as any;
      if (maybe && typeof maybe === 'object' && typeof maybe.digest === 'string' && maybe.digest.startsWith('NEXT_REDIRECT')) {
        throw e;
      }
    } catch (rethrowErr) {
      throw rethrowErr;
    }
    logger.warn('LandingPage: session check failed', { className: 'LandingPage', methodName: 'load', error: String(e as any) });
  }

  return <LandingPageInteractive />;
}
