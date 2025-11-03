// ...existing code...
'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import Avatar from '@/components/UI/Avatar';
import { SessionUser } from '@/lib/types';
import ProfileWidgets from '@/components/ProfileWidgets';
import { extractBadges } from '@/lib/extractBadge';
import AuthRedeemOnSignIn from '@/components/AuthRedeemOnSignIn';

const OnboardingPage = dynamic(() => import('../onboarding/page'), { ssr: false });

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const badges = extractBadges(profile);

  useEffect(() => {
    let mounted = true;
    async function fetchProfile() {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          if (mounted) setProfile(data);
        }
      } catch {
        // ignore fetch errors; profile remains null
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (session) fetchProfile();
    else setLoading(false);
    return () => {
      mounted = false;
    };
  }, [session]);

  if (!session) return <div className="p-6">You are not signed in.</div>;
  if (loading) return <div className="p-6">Loading...</div>;

  if (showOnboarding) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 max-w-lg w-full relative">
          <button
            className="absolute top-2 right-2 text-gray-500 dark:text-gray-300 text-xl"
            onClick={() => setShowOnboarding(false)}
            aria-label="Close"
          >
            ×
          </button>
          {/* OnboardingPage is client-only via dynamic import */}
          <OnboardingPage />
        </div>
      </div>
    );
  }

  const fallback =
    session.user?.name?.charAt(0).toUpperCase() ||
    session.user?.email?.charAt(0).toUpperCase() ||
    '?';

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white dark:bg-gray-900 rounded-xl shadow-lg text-gray-900 dark:text-gray-100">
      {/* global/client redeem handler (safe to mount even if also mounted in layout) */}
      <AuthRedeemOnSignIn />

      {/* client widgets: invite, badges, leaderboard, weekly challenge */}
      <ProfileWidgets badges={badges} showLeaderboard showChallenge />

      {/* Profile Header */}
      <div className="flex flex-col items-center mb-8">
        <Avatar
          src={session.user?.image || undefined}
          alt={session.user?.name || session.user?.email || 'User avatar'}
          size={80}
          fallback={fallback}
        />
        <h1 className="text-3xl font-bold mt-2">{session.user?.name}</h1>
        <p className="text-gray-500 dark:text-gray-400">{session.user?.email}</p>
        <button
          type="button"
          className="mt-4 px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => setShowOnboarding(true)}
        >
          Update Profile
        </button>
      </div>

      {/* Profile Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Account Info */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4 h-fit">
          <div>
            <span className="font-semibold">Plan:</span>{' '}
            {profile?.plan || <span className="text-gray-400">Not set</span>}
          </div>
          <div>
            <span className="font-semibold">Billing Cycle:</span>{' '}
            {profile?.billingCycle || <span className="text-gray-400">Not set</span>}
          </div>
          <div>
            <span className="font-semibold">Role:</span>{' '}
            {profile?.role || <span className="text-gray-400">Not set</span>}
          </div>
          <div>
            <span className="font-semibold">Member since:</span>{' '}
            {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
          </div>
        </div>

        {/* Personal Info */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4 h-fit">
          <div>
            <span className="font-semibold">Country:</span>{' '}
            {profile?.country || <span className="text-gray-400">Not set</span>}
          </div>
          <div>
            <span className="font-semibold">Grade:</span>{' '}
            {profile?.grade || <span className="text-gray-400">Not set</span>}
          </div>
          <div>
            <span className="font-semibold">Parent Email:</span>{' '}
            {profile?.parentEmail || <span className="text-gray-400">Not set</span>}
          </div>
          <div>
            <span className="font-semibold">Language:</span>{' '}
            {profile?.language || <span className="text-gray-400">Not set</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
