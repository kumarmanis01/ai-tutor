'use client';

import React, { useState, useEffect } from 'react';
import useCurrentUser from '@/hooks/useCurrentUser';

/**
 * WelcomeBanner - Shows a one-time welcome message for new students
 * after they complete onboarding. Dismissed after first view.
 */
export function WelcomeBanner() {
  const { data: profile } = useCurrentUser();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !profile) return;
    const key = `spinzy:welcome-dismissed:${profile.id || 'default'}`;
    const dismissed = sessionStorage.getItem(key);
    if (dismissed) return;

    // Show banner if user was created recently (within last 5 minutes)
    // or if they have no test results yet (new user)
    const createdAt = (profile as any).createdAt;
    const isNew = createdAt
      ? Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000
      : false;

    // Also check if there's a fresh onboarding flag in the URL
    const params = new URLSearchParams(window.location.search);
    const justOnboarded = params.get('onboarded') === '1';

    if (isNew || justOnboarded) {
      setVisible(true);
    }
  }, [profile]);

  const dismiss = () => {
    setVisible(false);
    if (typeof window !== 'undefined' && profile) {
      const key = `spinzy:welcome-dismissed:${profile.id || 'default'}`;
      sessionStorage.setItem(key, '1');
    }
  };

  if (!visible) return null;

  const firstName = profile?.name?.split(' ')[0] || 'there';

  return (
    <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white overflow-hidden">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-white/70 hover:text-white text-sm"
        aria-label="Dismiss"
      >
        x
      </button>
      <h2 className="text-lg font-bold mb-1">
        Welcome to Spinzy Academy, {firstName}!
      </h2>
      <p className="text-sm text-indigo-100 mb-3">
        Your personalized learning journey starts now. Here&apos;s how to get the most out of it:
      </p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-white/10 rounded-xl p-3">
          <div className="text-xl mb-1">1</div>
          <p className="text-xs">Start with today&apos;s task below</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3">
          <div className="text-xl mb-1">2</div>
          <p className="text-xs">Ask questions anytime in Doubts</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3">
          <div className="text-xl mb-1">3</div>
          <p className="text-xs">Track your progress weekly</p>
        </div>
      </div>
    </div>
  );
}

export default WelcomeBanner;
