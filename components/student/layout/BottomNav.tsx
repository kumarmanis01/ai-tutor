'use client';

/**
 * BottomNav -- v2 mobile primary navigation
 *
 * Fixed bottom bar, full width, iOS safe-area-aware.
 * 4 items: Home / Learn / Doubts / Profile
 * Active item: icon + label in #534AB7
 * Inactive:    icon + label in gray
 * Each tap target: min-h-[44px], covers full cell width.
 *
 * Hidden on md: and above -- desktop uses the Topbar only.
 * bg-white dark:bg-gray-950 with top border.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    label: 'Home',
    href: '/dashboard',
    matchExact: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="w-6 h-6"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Learn',
    href: '/learn',
    matchExact: false,
    matchPaths: ['/learn', '/session'],
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="w-6 h-6"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    label: 'Doubts',
    href: '/doubts',
    matchExact: false,
    matchPaths: ['/doubts', '/dashboard/doubts'],
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="w-6 h-6"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Profile',
    href: '/profile',
    matchExact: false,
    matchPaths: ['/profile', '/dashboard/profile'],
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="w-6 h-6"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  function isActive(item: (typeof NAV_ITEMS)[number]): boolean {
    if (item.matchExact) {
      return pathname === item.href;
    }
    const paths = (item as unknown as { matchPaths?: string[] }).matchPaths ?? [item.href];
    return paths.some((p) => pathname === p || pathname.startsWith(p + '/'));
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-slate-800 md:hidden"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      aria-label="Main navigation"
    >
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-2 transition-colors',
                active
                  ? 'text-[#534AB7]'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
              ].join(' ')}
            >
              {item.icon}
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
