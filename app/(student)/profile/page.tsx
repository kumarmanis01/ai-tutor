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
 * - 2026-05-17 | claude | refactor: adopt design system primitives (Task 2 UI migration)
 */

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Flame, Zap, Trophy, Edit2, Shield, Target, ArrowRight } from 'lucide-react';
import Avatar from '@/components/UI/Avatar';
import LogoutButton from '@/components/Auth/LogoutButton';
import type { User } from '@/lib/types';
import ProfileWidgets from '@/components/ProfileWidgets';
import { COSMETIC_ITEMS } from '@/lib/student/cosmetics';
import { getTierColor, getLevelTierName } from '@/lib/student/xpLevels';
import { extractBadges } from '@/lib/extractBadge';
import AuthRedeemOnSignIn from '@/components/AuthRedeemOnSignIn';
import useCurrentUser from '@/hooks/useCurrentUser';
import { LANGUAGES } from '@/components/CascadingFilters';
import ParentAccessCard from '@/components/Profile/ParentAccessCard';
import FontSizeToggle from '@/components/UI/FontSizeToggle';
import { CardSkeleton } from '@/components/UI/loaders';
import { Button } from '@/components/UI/design-system/Button';
import { Card } from '@/components/UI/design-system/Card';
import { Pill } from '@/components/UI/design-system/Pill';
import { KV } from '@/components/UI/design-system/KV';
import { SubjectChip, SubjectId } from '@/components/UI/design-system/SubjectChip';

// grade/board immutable after first save -- strip from all PATCH handlers
const SUBJECT_NAME_TO_ID: Record<string, SubjectId> = {
  mathematics: 'mathematics', math: 'mathematics',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  science: 'science',
  english: 'english',
  'social studies': 'social', social: 'social',
  hindi: 'hindi',
};

function SubjectTag({ name }: { name: string }) {
  const id = SUBJECT_NAME_TO_ID[name.toLowerCase()];
  if (id) return <SubjectChip subjectId={id} />;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary-bg text-primary">
      {name}
    </span>
  );
}

function formatDate(val: string | Date | undefined | null): string {
  if (!val) return '';
  try {
    return new Date(val).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
  } catch {
    return String(val);
  }
}

// Feature flag: never render referral UI until Task 28 ships
const FEATURE_REFERRALS = false;

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

  if (!session) return <div className="p-6 text-foreground">You are not signed in.</div>;

  if (loading) return (
    <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8 py-6">
      <div className="space-y-5">
        <div className="loader-shimmer h-40 rounded-2xl" aria-hidden="true" />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div><CardSkeleton /></div>
        </div>
      </div>
      <span className="sr-only">Loading profile...</span>
    </div>
  );

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

  const showcaseCount = Array.isArray(profile?.preferences?.badgeShowcase)
    ? (profile.preferences.badgeShowcase as string[]).length
    : 0;

  const displayName = profile?.name ?? session?.user?.name ?? '';
  const displayEmail = profile?.email ?? session?.user?.email ?? '';
  const level = profile?.level ?? 1;
  const tierName = getLevelTierName(level);
  const currentStreak = profile?.currentStreak ?? 0;
  const longestStreak = profile?.longestStreak ?? 0;

  const subjectDisplay: string[] =
    profile?.resolvedSubjects && profile.resolvedSubjects.length > 0
      ? profile.resolvedSubjects.map((s) => s.name)
      : (profile?.subjects ?? []);

  // Suppress unused-variable lint for COSMETIC_ITEMS (used for future cosmetics display)
  void COSMETIC_ITEMS;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthRedeemOnSignIn />

      <main className="mx-auto max-w-page px-4 sm:px-6 lg:px-8 py-6 lg:py-7">
        {/* Identity Hero */}
        <Card variant="hero" padding="hero">
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-5 lg:gap-6">
            {/* Avatar */}
            <div className="shrink-0 p-0.5">
              <Avatar
                src={profile?.image ?? session?.user?.image ?? undefined}
                alt={displayName || 'User avatar'}
                size={88}
                fallback={fallback}
                tierColor={getTierColor(level)}
              />
            </div>

            {/* Identity block */}
            <div className="flex-1 min-w-0 text-center lg:text-left">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your profile</div>
              <h1 className="text-4xl font-headline font-semibold text-foreground leading-tight truncate">
                {displayName}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {displayEmail}
                {profile?.createdAt && (
                  <>
                    <span className="mx-1.5 opacity-40">&middot;</span>
                    Member since {formatDate(profile.createdAt)}
                  </>
                )}
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-2 mt-3">
                <Pill intent="amber" leftIcon={<Flame className="w-3 h-3" aria-hidden />}>
                  <strong>{currentStreak}</strong>-day streak
                  <span className="text-muted-foreground ml-1">&middot; best {longestStreak}d</span>
                </Pill>
                <Pill intent="primary" leftIcon={<Zap className="w-3 h-3" aria-hidden />}>
                  Level {level} &middot; {tierName}
                </Pill>
                {showcaseCount > 0 && (
                  <Pill intent="mint" leftIcon={<Trophy className="w-3 h-3" aria-hidden />}>
                    {showcaseCount} showcased
                  </Pill>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 w-full lg:w-auto lg:min-w-[180px]">
              <Link href="/student/onboarding?edit=1" className="block">
                <Button variant="primary" fullWidth leftIcon={<Edit2 className="w-4 h-4" aria-hidden />}>
                  Update profile
                </Button>
              </Link>
              <LogoutButton />
              {isAdmin && (
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => router.push('/admin')}
                >
                  Admin panel
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 lg:gap-6 items-start mt-5 lg:mt-6">
          {/* Main column */}
          <div className="flex flex-col gap-4 lg:gap-5">
            {/* Learning Goals Link */}
            <Link
              href="/dashboard/profile/learning-goals"
              className="block"
            >
              <Card padding="compact">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary-bg text-primary flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-headline font-semibold text-foreground">My Learning Goals</div>
                    <div className="text-xs text-muted-foreground">Set daily &amp; weekly study targets</div>
                  </div>
                  <div className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground">
                    <ArrowRight className="w-4 h-4" aria-hidden />
                  </div>
                </div>
              </Card>
            </Link>

            {/* Account & Plan */}
            <Card>
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Subscription</div>
                  <h2 className="text-lg font-headline font-semibold">Account &amp; plan</h2>
                </div>
                <Button variant="ghost" size="sm">Manage &rarr;</Button>
              </div>
              <KV label="Plan"          value={profile?.plan} />
              <KV label="Billing cycle" value={profile?.billingCycle} />
              <KV label="Role"          value={profile?.role} />
              <KV label="Member since"  value={formatDate(profile?.createdAt)} last />
            </Card>

            {/* Academic Preferences */}
            <Card>
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Learning</div>
                  <h2 className="text-lg font-headline font-semibold">Academic preferences</h2>
                </div>
              </div>
              <KV
                label="Language"
                value={profile?.language
                  ? (LANGUAGES.find((l) => l.code === profile.language)?.name ?? profile.language)
                  : null}
              />
              <KV label="Board"   value={profile?.board} />
              <KV label="Grade"   value={profile?.grade ? `Class ${profile.grade}` : null} />
              <KV
                label="Subjects"
                value={
                  subjectDisplay.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {subjectDisplay.map((name) => <SubjectTag key={name} name={name} />)}
                    </div>
                  ) : null
                }
              />
              <KV label="Country"      value={profile?.country} />
              <KV label="Parent email" value={profile?.parentEmail} last />
            </Card>

            {/* Display & Accessibility */}
            <Card>
              <div className="mb-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">How it looks</div>
                <h2 className="text-lg font-headline font-semibold">Display &amp; accessibility</h2>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3.5 py-3">
                <span className="text-xs text-muted-foreground">Font size</span>
                <span><FontSizeToggle /></span>
              </div>
            </Card>

            {/* Parent Access */}
            <ParentAccessCard />

            {/* Danger Zone */}
            <div className="border-t border-border pt-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-error-bg text-error flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" aria-hidden />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Privacy &amp; data</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Permanently deletes your account and personal data within 30 days.
                    </div>
                  </div>
                </div>
                {!deletionRequested ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeletionDialog(true)}
                  >
                    Request deletion
                  </Button>
                ) : (
                  <p className="text-sm text-success font-medium">Deletion request submitted.</p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-4 lg:gap-5">
            {FEATURE_REFERRALS && (
              <Card variant="warm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-warning-bg text-warning flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5" aria-hidden />
                  </div>
                  <h3 className="text-base font-headline font-semibold">Invite a friend</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Earn XP when a friend joins.</p>
                <Button variant="primary" fullWidth>Create invite</Button>
              </Card>
            )}
            <ProfileWidgets badges={badges} showLeaderboard showChallenge />
          </aside>
        </div>
      </main>

      {/* Deletion confirmation modal */}
      {showDeletionDialog && !deletionRequested && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full shadow-xl mx-4 border border-border">
            <h4 className="font-headline font-semibold text-lg mb-2 text-foreground">
              This cannot be undone
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Type <strong>DELETE</strong> to confirm account deletion:
            </p>
            <input
              type="text"
              value={deletionConfirmText}
              onChange={(e) => setDeletionConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full border border-border rounded-lg px-3 py-2 mb-4 text-sm bg-background text-foreground"
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => { setShowDeletionDialog(false); setDeletionConfirmText(''); }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                fullWidth
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
              >
                {deletionPending ? 'Submitting...' : 'Confirm deletion'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
