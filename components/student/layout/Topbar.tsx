'use client';

/**
 * FILE OBJECTIVE:
 * - Continuation-first global student top bar that keeps the next learning action
 *   and Ask Vidya one tap away across student routes.
 * - Mobile: two-line sticky layout with focus chip. Desktop: command-center row
 *   with focus chip, momentum chip, Ask Vidya CTA, search, and profile context.
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
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Flame, Moon, Sparkles, Sun, UserCircle2, X } from 'lucide-react';
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

const SEARCH_HINTS = {
  active: 'Search this chapter concepts',
  exam: 'Search formulas and revision questions',
  weak: 'Ask why this method works',
  recovery: 'Search examples and quick recap',
} as const;

const VIDYA_SEARCH_CONTEXT = {
  title: 'Search',
  subtitle: 'Search chapters, concepts, or quick recap',
  emptyQueryFallback: 'quick recap',
  searchSource: 'topbar-search',
} as const;

type TopbarMode = 'active' | 'exam' | 'weak' | 'recovery';

type FocusConfig = {
  focusLabel: string;
  etaLabel: string;
  askLabel: string;
  momentumLabel: string;
  contextTag: string;
};

const MODE_FOCUS: Record<TopbarMode, FocusConfig> = {
  active: {
    focusLabel: 'Continue: Algebra - Example 3',
    etaLabel: '12 mins left',
    askLabel: 'Ask Vidya',
    momentumLabel: 'You are building a great routine',
    contextTag: 'Active session',
  },
  exam: {
    focusLabel: 'Revision: Physics numericals before Monday test',
    etaLabel: '2 short tasks today',
    askLabel: 'Ask Vidya for quick revision',
    momentumLabel: 'You are on track',
    contextTag: 'Exam mode',
  },
  weak: {
    focusLabel: 'Strengthen fractions with 2 guided examples',
    etaLabel: 'Step-by-step support ready',
    askLabel: 'Ask Vidya to explain step by step',
    momentumLabel: 'Progress grows with each attempt',
    contextTag: 'Support mode',
  },
  recovery: {
    focusLabel: 'Welcome back. Resume where you paused.',
    etaLabel: 'Fresh start available today',
    askLabel: 'Need a quick recap? Ask Vidya',
    momentumLabel: 'Fresh start streak available',
    contextTag: 'Recovery mode',
  },
};

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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showStickyAsk, setShowStickyAsk] = useState(false);
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

  useEffect(() => {
    function handleScroll() {
      setShowStickyAsk(window.scrollY > 120);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const name = ((session?.user as { name?: string | null } | undefined)?.name ?? '').trim();
  const displayName = (profile?.name ?? name).trim();
  const firstName = displayName.split(' ')[0] || 'Student';
  const initial = (displayName.charAt(0) || 'S').toUpperCase();
  const userImage = ((session?.user as { image?: string | null } | undefined)?.image ?? '').trim();

  const streak = topbarData?.streak ?? 0;
  const level = topbarData?.level ?? 1;
  const shieldAvailable = topbarData?.shieldAvailable ?? false;

  const fallbackMode: TopbarMode = useMemo(() => {
    if (pathname.startsWith('/dashboard/tests') || pathname.startsWith('/tests')) return 'exam';
    if (pathname.startsWith('/dashboard/doubts') || pathname.startsWith('/doubts')) return 'weak';
    if (streak === 0) return 'recovery';
    return 'active';
  }, [pathname, streak]);

  const mode: TopbarMode = (topbarData?.focus.mode ?? fallbackMode) as TopbarMode;

  const focusConfig = MODE_FOCUS[mode];
  const resolvedFocus = {
    focusLabel: topbarData?.focus.focusLabel ?? focusConfig.focusLabel,
    etaLabel: topbarData?.focus.etaLabel ?? focusConfig.etaLabel,
    askLabel: topbarData?.focus.askLabel ?? focusConfig.askLabel,
    momentumLabel: topbarData?.focus.momentumLabel ?? focusConfig.momentumLabel,
    contextTag: topbarData?.focus.contextTag ?? focusConfig.contextTag,
    actionHref: topbarData?.focus.actionHref ?? TOPBAR_ROUTES.learn,
  };

  const searchPlaceholder = topbarData?.focus.searchPlaceholder ?? SEARCH_HINTS[mode];
  const shouldShowStickyAsk = showStickyAsk && (mode === 'active' || mode === 'weak');
  const isFree = profile !== undefined && !profile?.plan;

  const normalizedSearchValue = searchValue.trim();
  const searchTargetHref = `${TOPBAR_ROUTES.doubts}?q=${encodeURIComponent(
    normalizedSearchValue || VIDYA_SEARCH_CONTEXT.emptyQueryFallback
  )}&source=${VIDYA_SEARCH_CONTEXT.searchSource}`;

  const momentumChipText =
    streak > 0 ? `${streak}-day learning consistency` : 'Fresh start streak available';

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

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto max-w-screen-2xl px-3 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex min-h-[64px] items-center justify-between gap-2 lg:hidden">
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

          <div className="flex items-center gap-1">
            <Link
              href={TOPBAR_ROUTES.subscribe}
              aria-label="Upgrade"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-brand-warning-bg text-brand-warning"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => setStreakOpen((open) => !open)}
              aria-label={`${momentumChipText} - open details`}
              className={[
                'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full',
                mode === 'exam' ? 'bg-brand-warning-bg text-brand-warning' : 'bg-brand-success-bg text-success',
              ].join(' ')}
            >
              <Flame className="h-4 w-4" aria-hidden="true" />
              {shieldAvailable ? <span className="sr-only">Shield available</span> : null}
            </button>

            <Link
              href={TOPBAR_ROUTES.profile}
              data-testid="mobile-profile-button"
              aria-label="Open profile"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-muted"
            >
              {userImage ? (
                <Image
                  src={userImage}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-brand-primary-bg"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-brand-primary-fg ring-2 ring-brand-primary-bg">
                  {initial}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div className="hidden min-h-[72px] items-center justify-between gap-3 lg:flex">
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
            <Link
              href={TOPBAR_ROUTES.subscribe}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand-warning-bg px-4 py-2 text-sm font-semibold text-brand-warning"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Upgrade</span>
            </Link>

            <button
              ref={streakBtnRef}
              type="button"
              onClick={() => setStreakOpen((open) => !open)}
              aria-label={`${momentumChipText} - open details`}
              className={[
                'inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
                mode === 'exam' ? 'bg-brand-warning-bg text-brand-warning' : 'bg-brand-success-bg text-success',
              ].join(' ')}
            >
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{momentumChipText}</span>
              <span className="rounded-full bg-brand-primary-bg px-2 py-0.5 text-brand-primary">Lv {level}</span>
            </button>

            <Link
              href={TOPBAR_ROUTES.profile}
              aria-label="My profile"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-background px-2 py-1 hover:bg-muted"
            >
              {userImage ? (
                <Image
                  src={userImage}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-brand-primary-bg"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-brand-primary-fg ring-2 ring-brand-primary-bg">
                  {initial}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Legacy topbar layout kept for future reference as requested. */}
        {/**
        <div className="pb-2 lg:hidden">
          <motion.div
            className="rounded-xl border border-border bg-background px-3.5 py-2.5 shadow-sm"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="truncate text-sm font-medium text-foreground">{resolvedFocus.focusLabel}</p>
            <p className="truncate text-xs text-muted-foreground">{resolvedFocus.etaLabel}</p>
            <p className="sr-only" aria-live="polite">
              Today focus updated: {resolvedFocus.focusLabel}
            </p>
          </motion.div>
        </div>
        */}
      </div>

      {streakOpen ? (
        <div className="pointer-events-none absolute right-3 top-[56px] z-50 sm:right-4 lg:right-6 xl:right-8">
          <div className="pointer-events-auto">
            <StreakWidget onClose={closeStreak} />
          </div>
        </div>
      ) : null}

      {/* Sticky Ask strip removed — Ask Vidya is available in bottom nav */}

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

      <AnimatePresence>
        {mobileSearchOpen ? (
          <>
            <motion.button
              aria-label="Close search"
              className="fixed inset-0 z-[60] bg-black/30"
              onClick={() => setMobileSearchOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              data-testid="mobile-search-sheet"
              className="fixed inset-x-0 bottom-0 z-[61] max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-xl"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 0.18 }}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                    <p className="text-sm font-semibold text-foreground">{VIDYA_SEARCH_CONTEXT.title}</p>
                    <p className="text-xs text-muted-foreground">{VIDYA_SEARCH_CONTEXT.subtitle}</p>
                  </div>
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(false)}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground"
                  aria-label="Close search"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2">
                <label htmlFor="mobile-topbar-search" className="sr-only">
                  Search chapters, concepts, and formulas
                </label>
                <input
                  id="mobile-topbar-search"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="px-1 text-xs text-muted-foreground">
                  Tip: Search examples, formulas, or why a method works.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileSearchOpen(false)}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-border px-3 text-sm font-medium text-foreground"
                  >
                    Cancel
                  </button>
                  <Link
                    href={searchTargetHref}
                    onClick={() => setMobileSearchOpen(false)}
                    className="inline-flex min-h-[44px] items-center rounded-full bg-brand-primary px-4 text-sm font-semibold text-brand-primary-fg"
                  >
                    Search
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
