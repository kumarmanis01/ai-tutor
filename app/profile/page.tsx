'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import Avatar from '@/components/UI/Avatar';
import type { User } from '@/lib/types';
import ProfileWidgets from '@/components/ProfileWidgets';
import { extractBadges } from '@/lib/extractBadge';
import AuthRedeemOnSignIn from '@/components/AuthRedeemOnSignIn';
import useCurrentUser from '@/hooks/useCurrentUser';

const OnboardingPage = dynamic(() => import('../onboarding/page'), { ssr: false });

export default function ProfilePage() {
  const { data: session } = useSession();
  const { data: profile, loading } = useCurrentUser();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const badges = extractBadges(profile as User | null);

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
          <OnboardingPage />
        </div>
      </div>
    );
  }

  const fallback =
    profile?.name?.charAt(0).toUpperCase() ||
    session.user?.name?.charAt(0).toUpperCase() ||
    session.user?.email?.charAt(0).toUpperCase() ||
    '?';

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white dark:bg-gray-900 rounded-xl shadow-lg text-gray-900 dark:text-gray-100">
      {/* keep redeem handler mounted */}
      <AuthRedeemOnSignIn />

      {/* layout: main profile on left, widgets (leaderboard/badges) on right */}
      <div className="flex flex-col md:flex-row gap-8">
        <main className="flex-1">
          {/* Profile Header */}
          <div className="flex flex-col items-center mb-8">
            <Avatar
              src={profile?.image ?? session.user?.image ?? undefined}
              alt={profile?.name ?? session.user?.name ?? session.user?.email ?? 'User avatar'}
              size={80}
              fallback={fallback}
            />
            <h1 className="text-3xl font-bold mt-2">{profile?.name ?? session.user?.name}</h1>
            <p className="text-gray-500 dark:text-gray-400">{profile?.email ?? session.user?.email}</p>
            <button
              type="button"
              className="mt-4 px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => setShowOnboarding(true)}
            >
              Update Profile
            </button>
          </div>

          {/* Profile Details */}
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
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

            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
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
        </main>

        {/* Sidebar widgets: keeps leaderboard visible but not above profile */}
        <aside className="w-full md:w-80 flex-shrink-0 space-y-6">
          <ProfileWidgets badges={badges} showLeaderboard showChallenge />
        </aside>
      </div>
    </div>
  );
}
