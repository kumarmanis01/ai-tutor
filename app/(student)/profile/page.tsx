'use client';
/**
 * FILE OBJECTIVE:
 * - User profile page displaying account info, academic preferences, and widgets.
 * - Shows cascading academic info: Language -> Board -> Grade -> Subjects.
 * - Links to Learning Goals sub-page.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/profile/page.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-03 | claude | added academic preferences section with cascading info
 * - 2026-02-21 | claude | restored original profile page; linked to learning-goals sub-route
 */
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/UI/Avatar';
import LogoutButton from '@/components/Auth/LogoutButton';
import type { User } from '@/lib/types';
import ProfileWidgets from '@/components/ProfileWidgets';
import { COSMETIC_ITEMS } from '@/lib/student/cosmetics';
import { extractBadges } from '@/lib/extractBadge';
import AuthRedeemOnSignIn from '@/components/AuthRedeemOnSignIn';
import useCurrentUser from '@/hooks/useCurrentUser';
import { LANGUAGES, _DIFFICULTY_LEVELS } from '@/components/CascadingFilters';
import Link from 'next/link';
import ParentAccessCard from '@/components/Profile/ParentAccessCard';
import { useState } from 'react';

export default function ProfilePage() {
  const { data: session } = useSession();
  const sess = session as unknown as import('@/lib/types/auth').AppSession | null;
  const { data: profile, loading } = useCurrentUser();
  const router = useRouter();
  const badges = extractBadges(profile as User | null);
  const [deletionConfirmText, setDeletionConfirmText] = useState('');
  const [deletionPending, setDeletionPending] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [showDeletionDialog, setShowDeletionDialog] = useState(false);

  if (!session) return <div className="p-6">You are not signed in.</div>;
  if (loading) return <div className="p-6">Loading...</div>;

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
            <div className="mt-2 flex gap-3 items-center text-sm text-gray-600 dark:text-gray-300">
              <div className="inline-flex items-center gap-2">
                <span className="text-lg">🔥</span>
                <span>
                  {profile?.currentStreak ?? 0}d
                  <span className="text-gray-400 ml-1">(best {profile?.longestStreak ?? 0}d)</span>
                </span>
              </div>
              {profile?.cosmeticUnlocks && profile.cosmeticUnlocks.length > 0 && (
                <div className="inline-flex items-center gap-2">
                  <span className="text-xs text-gray-400">Unlocked:</span>
                  <div className="inline-flex gap-1 flex-wrap">
                    {COSMETIC_ITEMS.filter(ci => (profile.cosmeticUnlocks ?? []).includes(ci.key)).map(ci => (
                      <span key={ci.key} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">{ci.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Link
              href="/student/onboarding"
              className="mt-4 inline-block px-5 py-2 min-h-[44px] leading-[28px] bg-[#534AB7] text-white text-sm font-semibold rounded-xl hover:bg-[#4840a3] transition-colors"
            >
              Update Profile
            </Link>
            <div className="mt-3 flex gap-2 items-center">
              <LogoutButton />
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

          {/* Learning Goals Link */}
          <div className="mb-6">
            <Link
              href="/dashboard/profile/learning-goals"
              className="flex items-center justify-between w-full p-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <p className="font-semibold text-foreground">My Learning Goals</p>
                  <p className="text-sm text-muted-foreground">Set daily & weekly study targets</p>
                </div>
              </div>
              <span className="text-muted-foreground group-hover:text-primary transition-colors text-xl">&rarr;</span>
            </Link>
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

            <ParentAccessCard />

            {/* Privacy & Data */}
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-red-200 dark:border-red-900 space-y-3">
              <h3 className="font-semibold text-lg text-red-700 dark:text-red-400">Privacy &amp; Data</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Delete my account and data
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Permanently deletes your account and personal data within 30 days.
                Learning analytics are kept anonymously.
              </p>
              {deletionRequested ? (
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                  Your deletion request has been submitted. You will receive a confirmation email.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeletionDialog(true)}
                  className="px-4 py-2 border border-red-500 text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                >
                  Request account deletion
                </button>
              )}
              {showDeletionDialog && !deletionRequested && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-xl mx-4">
                    <h4 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">
                      This cannot be undone
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Type <strong>DELETE</strong> to confirm account deletion:
                    </p>
                    <input
                      type="text"
                      value={deletionConfirmText}
                      onChange={(e) => setDeletionConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 mb-4 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowDeletionDialog(false); setDeletionConfirmText(''); }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={deletionConfirmText !== 'DELETE' || deletionPending}
                        onClick={async () => {
                          setDeletionPending(true);
                          try {
                            const res = await fetch('/api/student/account/deletion-request', { method: 'POST' });
                            if (res.ok) {
                              setDeletionRequested(true);
                              setShowDeletionDialog(false);
                              router.push('/login?message=deletion-requested');
                            }
                          } finally {
                            setDeletionPending(false);
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletionPending ? 'Submitting...' : 'Confirm deletion'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
