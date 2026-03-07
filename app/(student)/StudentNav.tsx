'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/UI/ThemeProvider';

interface StudentNavProps {
  studentName: string;
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/learn/learning-path', label: 'Learning Path' },
  { href: '/dashboard/doubts', label: 'Doubts' },
  { href: '/dashboard/profile', label: 'Profile' },
];

/**
 * Persistent student navigation bar.
 * - Uses Next.js Link for proper route-based navigation (no ?tab= query params).
 * - Active state derived from usePathname — highlights current route.
 * - Renders on /dashboard/*, /rooms/*, /profile, /parent, /learn/*.
 * - Never appears on public/marketing pages.
 */
export default function StudentNav({ studentName }: StudentNavProps) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === href || pathname.startsWith(href + '/');

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅';
    if (hour < 17) return '☀️';
    if (hour < 21) return '🌆';
    return '🌙';
  })();

  const firstName = studentName.split(' ')[0];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-border/30 h-14">
      <div className="max-w-5xl mx-auto px-4 h-full flex items-center justify-between gap-4">

        {/* Brand + greeting */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="hidden sm:inline text-sm font-semibold text-foreground">
            {greeting} {firstName || 'Student'}
          </span>
        </div>

        {/* Navigation links */}
        <nav className="hidden md:flex items-center gap-1 bg-muted/40 dark:bg-slate-800/60 rounded-full px-1 py-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right: theme toggle + logout */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="w-8 h-8 rounded-full bg-muted/60 dark:bg-slate-800/80 flex items-center justify-center transition-transform active:scale-95"
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <Link
            href="/logout"
            className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-red-500 hover:border-red-400 transition-colors"
          >
            Logout
          </Link>
        </div>
      </div>
    </header>
  );
}
