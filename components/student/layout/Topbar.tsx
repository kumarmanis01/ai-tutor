'use client';

/**
 * FILE OBJECTIVE:
 * - Continuation-first global student top bar that keeps the next learning action
 *   and Ask Vidya one tap away across student routes.
 * - Mobile: sticky layout with streak chip, XP chip, and avatar. Desktop: command-center row
 *   with streak chip, XP progress chip, upgrade button, and profile context.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/layout/Topbar.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | rebuild student top bar with adaptive focus, mobile two-line architecture, Framer Motion transitions, and sticky Ask Vidya strip
 * - 2026-05-09T00:00:00Z | copilot | wire topbar to dedicated backend focus contract payload endpoint
 * - 2026-05-09T00:00:00Z | copilot | consume combined topbar-stats payload for stats and focus in one SWR request
 * - 2026-05-10T00:00:00Z | copilot | add explicit search close/action controls and Vidya persona framing for desktop and mobile search UI
 * - 2026-05-10T00:00:00Z | copilot | apply mobile safe-area bottom spacing and overflow guard to expanded search sheet to avoid browser chrome overlap
 * - 2026-05-10T00:00:00Z | copilot | split desktop and mobile search state to prevent desktop search expansion from rendering mobile search sheet
 * - 2026-05-10T00:00:00Z | copilot | implement ordered topbar layout with Hi greeting, board-grade-school line, and right-aligned upgrade/streak/profile controls
 * - 2026-05-23T00:00:00Z | copilot | redesign right-side controls: streak chip, XP progress chip, upgrade dot on avatar (mobile) / upgrade link (desktop)
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/UI/Avatar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Flame, Moon, Sun, UserCircle2, X } from 'lucide-react';
import StreakWidget from '../dashboard/StreakWidget';
import Logo from '../../Logo';
import type { StudentTopbarStatsResponse } from '../../../lib/api/student/topbarContract';

const fetcher = (url: string) => fetch(url).then((response) => response.json());

const TOPBAR_ROUTES = {
  dashboard: '/dashboard',
  learn: '/learn',
  doubts: '/doubts',
  profile: '/profile',
  subscribe: '/subscribe',
} as const;

type UserProfile = {
  name?: string | null;
  grade?: string | null;
  board?: string | null;
  schoolName?: string | null;
  plan?: string | null;
};

export default function Topbar() {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const { data: session } = useSession();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);

  const streakBtnRef = useRef<HTMLButtonElement | null>(null);

  const { data: topbarData } = useSWR<StudentTopbarStatsResponse>(
    session ? '/api/student/topbar-stats' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const { data: profile } = useSWR<UserProfile>(
    session ? '/api/user/profile' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const name = ((session?.user as { name?: string | null } | undefined)?.name ?? '').trim();
  const displayName = (profile?.name ?? name).trim();
  const firstName = displayName.split(' ')[0] || 'Student';
  const initials = ((): string => {
    if (!displayName) return 'S';
    const parts = displayName.split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  })();
  const userImage = ((session?.user as { image?: string | null } | undefined)?.image ?? '').trim();

  const streak = topbarData?.streak ?? 0;
  const level = topbarData?.level ?? 1;
  const totalXp = topbarData?.totalXp ?? 0;
  const xpToNextLevel = topbarData?.xpToNextLevel ?? 1000;
  const shieldAvailable = topbarData?.shieldAvailable ?? false;
  const xpProgressPct = xpToNextLevel > 0 ? Math.min(100, Math.round((totalXp % xpToNextLevel) / xpToNextLevel * 100)) : 0;

  const isSessionRoute =
    pathname.startsWith('/session/') ||
    pathname.startsWith('/diagnostic/') ||
    pathname.startsWith('/tests/') ||
    pathname.startsWith('/practice/session/');

  const isFree = profile !== undefined && !profile?.plan;

  const isDaytime = useMemo(() => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18;
  }, []);

  const profileLineTwo = [
    profile?.board ? profile.board.toUpperCase() : 'BOARD',
    profile?.grade ? `Grade ${profile.grade}` : 'Grade',
    profile?.schoolName?.trim() ? profile.schoolName.trim() : 'School',
  ].join(', ');

  const closeStreak = useCallback(() => {
    setStreakOpen(false);
    try {
      streakBtnRef.current?.focus();
    } catch {
      // Ignore focus restoration errors in unsupported environments.
    }
  }, []);

  if (isSessionRoute) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto max-w-screen-2xl px-3 sm:px-4 lg:px-6 xl:px-8">
        {/* Mobile layout */}
        <div className="flex min-h-[56px] items-center justify-between gap-2 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={TOPBAR_ROUTES.dashboard}
              className="inline-flex min-h-[44px] min-w-[44px] items-center"
              aria-label="Spinzy home"
            >
              <Logo variant="account-navbar-mobile" />
            </Link>
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
                <span>Hi {firstName}</span>
                {isDaytime ? (
                  <Sun className="h-3.5 w-3.5 text-brand-warning" aria-hidden="true" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">{profileLineTwo}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              ref={streakBtnRef}
              type="button"
              onClick={() => setStreakOpen((open) => !open)}
              aria-label={`${streak > 0 ? `${streak}-day streak` : 'Start your streak'} - open details`}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-brand-success-bg px-3 text-xs font-semibold text-success"
            >
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{streak > 0 ? streak : '--'}</span>
              {shieldAvailable ? <span className="sr-only">Shield available</span> : null}
            </button>

            <div
              aria-label={`Level ${level}, ${xpProgressPct}% to next level`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#EEEDFE] dark:bg-[#534AB7]/20 px-3 py-1.5 text-xs font-semibold text-[#534AB7] dark:text-[#A8A3E8]"
            >
              <span>Lv {level}</span>
              <div className="h-1 w-10 rounded-full bg-[#C8C4F0] dark:bg-[#534AB7]/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#534AB7] dark:bg-[#A8A3E8] transition-all duration-500"
                  style={{ width: `${xpProgressPct}%` }}
                />
              </div>
            </div>

            <Link
              href={TOPBAR_ROUTES.profile}
              aria-label="My profile"
              className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
            >
              <Avatar
                src={userImage || undefined}
                alt={displayName || 'Profile'}
                fallback={initials}
                size={32}
                className="ring-2 ring-brand-primary-bg"
              />
              {isFree && (
                <span
                  className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#EF9F27] ring-2 ring-card"
                  aria-label="Free plan"
                />
              )}
            </Link>
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden min-h-[60px] items-center justify-between gap-3 lg:flex">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={TOPBAR_ROUTES.dashboard}
              className="inline-flex min-h-[44px] items-center"
              aria-label="Spinzy home"
            >
              <Logo variant="account-navbar" />
            </Link>
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-base font-semibold text-foreground">
                <span>Hi {firstName}</span>
                {isDaytime ? (
                  <Sun className="h-4 w-4 text-brand-warning" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">{profileLineTwo}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              ref={streakBtnRef}
              type="button"
              onClick={() => setStreakOpen((open) => !open)}
              aria-label={`${streak > 0 ? `${streak}-day streak` : 'Start your streak'} - open details`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-brand-success-bg px-3 py-1 text-xs font-semibold text-success"
            >
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{streak > 0 ? `${streak}-day streak` : 'Start your streak'}</span>
              {shieldAvailable ? <span className="sr-only">Shield available</span> : null}
            </button>

            <div
              aria-label={`Level ${level}, ${xpProgressPct}% to next level`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#EEEDFE] dark:bg-[#534AB7]/20 px-3 py-1.5 text-xs font-semibold text-[#534AB7] dark:text-[#A8A3E8]"
            >
              <span>Lv {level}</span>
              <div className="h-1 w-10 rounded-full bg-[#C8C4F0] dark:bg-[#534AB7]/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#534AB7] dark:bg-[#A8A3E8] transition-all duration-500"
                  style={{ width: `${xpProgressPct}%` }}
                />
              </div>
              <span className="text-[#534AB7]/70 dark:text-[#A8A3E8]/70">
                {totalXp % xpToNextLevel} / {xpToNextLevel} xp
              </span>
            </div>

            <div className="h-5 w-px bg-border" />

            {isFree && (
              <Link
                href={TOPBAR_ROUTES.subscribe}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#EF9F27]" aria-hidden="true" />
                Upgrade
              </Link>
            )}

            <Link
              href={TOPBAR_ROUTES.profile}
              aria-label="My profile"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-background px-2 py-1 hover:bg-muted"
            >
              <Avatar
                src={userImage || undefined}
                alt={displayName || 'Profile'}
                fallback={initials}
                size={32}
                className="ring-2 ring-brand-primary-bg"
              />
            </Link>
          </div>
        </div>
      </div>

      {streakOpen ? (
        <div className="pointer-events-none absolute right-3 top-[56px] z-50 sm:right-4 lg:right-6 xl:right-8">
          <div className="pointer-events-auto">
            <StreakWidget onClose={closeStreak} />
          </div>
        </div>
      ) : null}

      {/* Sticky Ask strip removed -- Ask Vidya is available in bottom nav */}

      <AnimatePresence>
        {menuOpen ? (
          <>
            <motion.button
              aria-label="Close menu"
              className="fixed inset-0 z-[60] bg-black/30"
              onClick={() => setMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              data-testid="mobile-menu-sheet"
              className="fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl border-t border-border bg-card p-3 shadow-xl"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 0.18 }}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-foreground">Menu</p>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <nav className="space-y-1" aria-label="Student menu">
                <Link
                  href={TOPBAR_ROUTES.dashboard}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Dashboard
                </Link>
                <Link
                  href={TOPBAR_ROUTES.learn}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Learn
                </Link>
                <Link
                  href={TOPBAR_ROUTES.doubts}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Doubts
                </Link>
                <Link
                  href={TOPBAR_ROUTES.profile}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Profile
                </Link>
                {isFree ? (
                  <Link
                    href={TOPBAR_ROUTES.subscribe}
                    onClick={() => setMenuOpen(false)}
                    className="mt-1 block rounded-lg bg-brand-warning-bg px-3 py-2 text-sm font-semibold text-brand-warning"
                  >
                    Upgrade to Premium
                  </Link>
                ) : null}
              </nav>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {profileOpen ? (
          <>
            <motion.button
              aria-label="Close profile"
              className="fixed inset-0 z-[60] bg-black/30"
              onClick={() => setProfileOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              data-testid="mobile-profile-sheet"
              className="fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl border-t border-border bg-card p-3 shadow-xl"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 0.18 }}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <UserCircle2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{displayName || 'Student'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {profile?.grade ? `Class ${profile.grade}` : 'Class'}
                    {profile?.board ? ` · ${profile.board?.toUpperCase()}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground"
                  aria-label="Close profile"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <nav className="space-y-1" aria-label="Profile menu">
                <Link
                  href={TOPBAR_ROUTES.profile}
                  onClick={() => setProfileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  View profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Settings
                </Link>
                <Link
                  href="/help"
                  onClick={() => setProfileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Help
                </Link>
              </nav>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
