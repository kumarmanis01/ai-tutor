'use client';
/**
 * FILE OBJECTIVE:
 * - User profile page displaying account info, academic preferences, and widgets.
 * - Shows cascading academic info: Language → Board → Grade → Subjects.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/profile/page.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | added academic preferences section with cascading info
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/UI/Avatar';
import LogoutButton from '@/components/Auth/LogoutButton';
import type { User } from '@/lib/types';
import ProfileWidgets from '@/components/ProfileWidgets';
import { extractBadges } from '@/lib/extractBadge';
import AuthRedeemOnSignIn from '@/components/AuthRedeemOnSignIn';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useOnboarding } from '@/context/OnboardingProvider';
import { LANGUAGES, _DIFFICULTY_LEVELS } from '@/components/CascadingFilters';

export default function ProfilePage() {
  const { data: session } = useSession();
  const sess = session as unknown as import('@/lib/types/auth').AppSession | null;
  const { data: profile, loading } = useCurrentUser();
  const { open } = useOnboarding();

  const router = useRouter();

  const badges = extractBadges(profile as User | null);

  if (!session) return <div className="p-6">You are not signed in.</div>;
  if (loading) return <div className="p-6">Loading...</div>;

  // Onboarding modal is mounted globally via providers; we just trigger it

  const fallback =
    profile?.name?.charAt(0).toUpperCase() ||
    session?.user?.name?.charAt(0).toUpperCase() ||
    session?.user?.email?.charAt(0).toUpperCase() ||
    '?';

  const isAdmin = (() => {
    const profRole = (profile as any)?.role;
    const sessRole = sess?.user?.role;
    return profRole === 'admin' || sessRole === 'admin';
  })();

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
              src={profile?.image ?? session?.user?.image ?? undefined}
                alt={profile?.name ?? session?.user?.name ?? session?.user?.email ?? 'User avatar'}
              size={80}
              fallback={fallback}
            />
            <h1 className="text-3xl font-bold mt-2">{profile?.name ?? session?.user?.name}</h1>
            <p className="text-gray-500 dark:text-gray-400">{profile?.email ?? session?.user?.email}</p>
            <button
              type="button"
              className="mt-4 px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => open({ force: true })}
            >
              Update Profile
            </button>
            <div className="mt-3 flex gap-2 items-center">
              <LogoutButton />
              {/* Show Admin button for admin users only, use client-side navigation */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => router.push('/admin')}
                  className="px-3 py-1 rounded-md bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
                  style={{ textDecoration: 'none' }}
                >
                  Admin
                </button>
              )}
            </div>
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
              <h3 className="font-semibold text-lg mb-3">Academic Preferences</h3>
              <div>
                <span className="font-semibold">Language:</span>{' '}
                {profile?.language ? (
                  LANGUAGES.find(l => l.code === profile.language)?.name || profile.language
                ) : (
                  <span className="text-gray-400">Not set</span>
                )}
              </div>
              <div>
                <span className="font-semibold">Board:</span>{' '}
                {profile?.board || <span className="text-gray-400">Not set</span>}
              </div>
              <div>
                <span className="font-semibold">Grade:</span>{' '}
                {profile?.grade ? `Class ${profile.grade}` : <span className="text-gray-400">Not set</span>}
              </div>
              <div>
                <span className="font-semibold">Subjects:</span>{' '}
                {profile?.subjects && profile.subjects.length > 0 ? (
                  <span className="inline-flex flex-wrap gap-1 mt-1">
                    {profile.subjects.map((s: string) => (
                      <span key={s} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-sm">
                        {s}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-gray-400">Not set</span>
                )}
              </div>
              <div>
                <span className="font-semibold">Country:</span>{' '}
                {profile?.country || <span className="text-gray-400">Not set</span>}
              </div>
              <div>
                <span className="font-semibold">Parent Email:</span>{' '}
                {profile?.parentEmail || <span className="text-gray-400">Not set</span>}
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
