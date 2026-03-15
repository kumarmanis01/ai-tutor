'use client';

/**
 * Topbar — v2 global student navigation bar
 *
 * Slim ~44px sticky bar at the top of every student route.
 * - Left:  Spinzy logo (icon + wordmark)
 * - Right: streak badge (only when streak > 0) + level badge + avatar initials
 *
 * Data: name + avatar from useSession (no extra fetch);
 *       streak + level from SWR /api/student/topbar-stats (60s revalidation).
 *
 * Desktop (md+): topbar is the only persistent navigation — bottom nav is hidden.
 * Mobile:        topbar shows brand + user stats; bottom nav handles page navigation.
 */

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type TopbarStats = { streak: number; level: number };

export default function Topbar() {
  const { data: session } = useSession();

  const { data: stats } = useSWR<TopbarStats>(
    session ? '/api/student/topbar-stats' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const name: string =
    (session?.user as { name?: string | null })?.name ?? '';
  const initial = name.trim() ? name.trim().charAt(0).toUpperCase() : 'S';

  const streak = stats?.streak ?? 0;
  const level = stats?.level ?? 1;

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-slate-800 min-h-[44px]">
      <div className="px-4 h-full flex items-center justify-between gap-3 py-2">

        {/* Left: logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 flex-shrink-0 min-h-[44px] min-w-[44px] -ml-1 px-1"
          aria-label="Spinzy home"
        >
          <div className="w-7 h-7 rounded-lg bg-[#534AB7] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs leading-none">S</span>
          </div>
          <span className="font-bold text-sm text-[#534AB7] hidden sm:inline select-none">
            Spinzy
          </span>
        </Link>

        {/* Right: badges + avatar */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Streak badge — only when streak > 0 */}
          {streak > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/40 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300"
              aria-label={`${streak} day streak`}
            >
              🔥 {streak}
            </span>
          )}

          {/* Level badge */}
          <span
            className="inline-flex items-center rounded-full bg-[#534AB7]/10 dark:bg-[#534AB7]/20 px-2.5 py-1 text-xs font-semibold text-[#534AB7] dark:text-indigo-300"
            aria-label={`Level ${level}`}
          >
            Lv {level}
          </span>

          {/* Avatar — links to profile */}
          <Link
            href="/profile"
            className="w-8 h-8 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="My profile"
          >
            <span className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center">
              <span className="text-white font-semibold text-xs leading-none">{initial}</span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
