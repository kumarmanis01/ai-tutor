'use client';

/**
 * Topbar -- v2 global student navigation bar
 *
 * Slim ~44px sticky bar at the top of every student route.
 * - Left:  Spinzy logo (icon + wordmark)
 * - Right: streak badge (tap to open StreakWidget popover) + level badge + avatar initials
 *
 * Data: name + avatar from useSession (no extra fetch);
 *       streak + level from SWR /api/student/topbar-stats (60s revalidation).
 *
 * Desktop (md+): topbar is the only persistent navigation -- bottom nav is hidden.
 * Mobile:        topbar shows brand + user stats; bottom nav handles page navigation.
 */

import React, { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import StreakWidget from '@/components/student/dashboard/StreakWidget';
import { UpgradeFlow } from '@/components/student/subscription/UpgradeFlow';
import Logo from '@/components/Logo';
import { getTierColor } from '@/lib/student/xpLevels';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type TopbarStats = {
  streak: number;
  longestStreak?: number;
  level: number;
  shieldAvailable: boolean;
};
type UserProfile = {
  id?: string;
  name?: string | null;
  grade?: string | null;
  board?: string | null;
  schoolName?: string | null;
  plan?: string | null;
  userBadges?: unknown[];
};

export default function Topbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const streakBtnRef = useRef<HTMLButtonElement | null>(null);

  const { data: stats } = useSWR<TopbarStats>(
    session ? '/api/student/topbar-stats' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // Fetch canonical user profile for display (name, school, grade, board, plan)
  const { data: profile } = useSWR<UserProfile>(session ? '/api/user/profile' : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const name: string = (session?.user as { name?: string | null })?.name ?? '';
  const initial = name.trim() ? name.trim().charAt(0).toUpperCase() : 'S';

  const streak = stats?.streak ?? 0;
  const level = stats?.level ?? 1;
  const shieldAvailable = stats?.shieldAvailable ?? false;

  // Show upgrade button once profile has loaded and has no active plan
  const isFree = profile !== undefined && !profile?.plan;

  const studentEmail = (session?.user as { email?: string | null })?.email ?? null;

  const closeStreak = useCallback(() => {
    setStreakOpen(false);
    // return focus to the opener button when the popover closes
    try {
      streakBtnRef.current?.focus();
    } catch {
      // ignore
    }
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-slate-800 min-h-[44px]">
      <div className="px-4 h-full flex items-center justify-between gap-3 py-2">
        {/* Mobile left: menu icon (only on small screens) */}
        <button
          data-testid="mobile-menu-button"
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="mr-2 md:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] min-w-[44px]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M3 5h14a1 1 0 100-2H3a1 1 0 100 2zm14 6H3a1 1 0 100 2h14a1 1 0 100-2zm0 6H3a1 1 0 100 2h14a1 1 0 100-2z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {/* Left: logo */}
        <Link
          href="/dashboard"
          className="flex items-center flex-shrink-0 min-h-[44px] min-w-[44px] -ml-1 px-1"
          aria-label="Spinzy home"
        >
          <span className="hidden sm:flex">
            <Logo variant="navbar" />
          </span>
          <span className="flex sm:hidden">
            <Logo variant="navbar-mobile" />
          </span>
        </Link>

        {/* Middle (md+): student name & meta (school, grade, board, plan) */}
        <div className="hidden md:flex flex-col ml-3">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {profile?.name ?? name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {profile?.schoolName ? `${profile.schoolName}` : ''}
            {profile?.grade ? ` · Grade ${profile.grade}` : ''}
            {profile?.board ? ` · ${profile.board?.toUpperCase()}` : ''}
            {profile?.plan ? ` · ${profile.plan}` : ''}
          </span>
        </div>

        {/* Right: badges + avatar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Upgrade button -- shown for free-tier users only */}
          {isFree && (
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#F97316] px-3 py-1 text-xs font-semibold text-white min-h-[36px] hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
              aria-label="Upgrade to Premium"
            >
              ✨ Upgrade
            </button>
          )}

          {/* Streak badge -- tap to open StreakWidget popover */}
          {(streak > 0 || shieldAvailable) && (
            <div className="relative">
              <button
                ref={streakBtnRef}
                type="button"
                onClick={() => setStreakOpen((o) => !o)}
                aria-label={`${streak} day streak -- tap for details`}
                aria-expanded={streakOpen}
                className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/40 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300 min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
              >
                🔥 {streak}
                {shieldAvailable && (
                  <span className="text-xs ml-0.5" aria-hidden="true">
                    🛡️
                  </span>
                )}
              </button>

              {streakOpen && <StreakWidget onClose={closeStreak} />}
            </div>
          )}

          {/* Level badge */}
          <span
            className="inline-flex items-center rounded-full bg-[#534AB7]/10 dark:bg-[#534AB7]/20 px-2.5 py-1 text-xs font-semibold text-[#534AB7] dark:text-indigo-300"
            aria-label={`Level ${level}`}
          >
            Lv {level}
          </span>

          {/* Avatar -- links to profile (desktop) */}
          <Link
            href="/profile"
            className="hidden md:flex w-8 h-8 min-w-[44px] min-h-[44px] items-center justify-center"
            aria-label="My profile"
          >
            <span
              className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center"
              style={{ outline: `3px solid ${getTierColor(level)}`, outlineOffset: '2px' }}
            >
              <span className="text-white font-semibold text-xs leading-none">{initial}</span>
            </span>
          </Link>

          {/* Mobile right: profile icon button (only on small screens) */}
          <button
            data-testid="mobile-profile-button"
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="Open profile"
            className="md:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] min-w-[44px]"
          >
            <span
              className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center"
              style={{ outline: `3px solid ${getTierColor(level)}`, outlineOffset: '2px' }}
            >
              <span className="text-white font-semibold text-xs leading-none">{initial}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Sheet */}
      {menuOpen && (
        <div
          data-testid="mobile-menu-sheet"
          className="fixed left-0 right-0 bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-t-lg shadow z-50 p-2"
        >
          <div className="flex items-center justify-between mb-2 px-2">
            <div className="text-sm font-semibold">Menu</div>
            <button type="button" onClick={() => setMenuOpen(false)} className="text-gray-600">
              ✕
            </button>
          </div>
          <nav>
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm"
            >
              Dashboard
            </Link>
            <Link
              href="/learn"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm"
            >
              Learn
            </Link>
            <Link
              href="/rooms"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm"
            >
              Rooms
            </Link>
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm"
            >
              Profile
            </Link>
            {isFree && (
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setUpgradeOpen(true); }}
                className="w-full text-left px-3 py-2 text-sm font-semibold text-[#F97316] min-h-[44px]"
              >
                ✨ Upgrade to Premium
              </button>
            )}
          </nav>
        </div>
      )}

      {/* Mobile Profile Sheet */}
      {profileOpen && (
        <div
          data-testid="mobile-profile-sheet"
          className="fixed left-0 right-0 bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-t-lg shadow z-50 p-2"
        >
          <div className="flex items-center justify-between mb-2 px-2">
            <div className="text-sm font-semibold">Profile</div>
            <button type="button" onClick={() => setProfileOpen(false)} className="text-gray-600">
              ✕
            </button>
          </div>
          <nav>
            <Link
              href="/profile"
              onClick={() => setProfileOpen(false)}
              className="block px-3 py-2 text-sm"
            >
              View profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setProfileOpen(false)}
              className="block px-3 py-2 text-sm"
            >
              Settings
            </Link>
            <Link
              href="/help"
              onClick={() => setProfileOpen(false)}
              className="block px-3 py-2 text-sm"
            >
              Help
            </Link>
          </nav>
        </div>
      )}
      {/* Upgrade flow modal -- full-screen overlay triggered from upgrade button */}
      {upgradeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Upgrade to Premium"
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center"
        >
          <div className="relative w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl max-h-[90vh]">
            <button
              type="button"
              onClick={() => setUpgradeOpen(false)}
              aria-label="Close upgrade flow"
              className="absolute right-4 top-4 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ✕
            </button>
            <UpgradeFlow
              studentName={profile?.name ?? name}
              studentEmail={studentEmail}
            />
          </div>
        </div>
      )}
    </header>
  );
}
