'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized bottom navigation with large tap targets and clear visual feedback.
 * - Updated IA: Home, Notes, Practice, Doubts, Profile (per PRD).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/BottomNavigator.spec.ts
 *
 * EDIT LOG:
 * - 2025-01-22 | copilot | simplified design with better tap targets for mobile
 * - 2026-02-04 | claude | added Doubts tab, reordered per PRD IA
 * - 2026-02-21 | claude | converted to Link-based routing (no ?tab= query params)
 */
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Navigation tab types matching PRD information architecture */
export type TabId = 'home' | 'notes' | 'tests' | 'doubts' | 'profile';

/**
 * Navigation tabs following PRD IA:
 * 1. Home     → /dashboard
 * 2. Notes    → /dashboard/notes
 * 3. Practice → /dashboard/tests
 * 4. Doubts   → /dashboard/doubts
 * 5. Profile  → /dashboard/profile
 */
const tabs: { id: TabId; label: string; href: string; icon: string }[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    id: 'notes',
    label: 'Notes',
    href: '/dashboard/notes',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    id: 'tests',
    label: 'Practice',
    href: '/dashboard/tests',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  {
    id: 'doubts',
    label: 'Doubts',
    href: '/dashboard/doubts',
    icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    id: 'profile',
    label: 'Me',
    href: '/dashboard/profile',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
];

const BottomNavigation: React.FC = () => {
  const pathname = usePathname();

  const isActive = (tab: { id: TabId; href: string }) =>
    tab.id === 'home' ? pathname === '/dashboard' : pathname.startsWith(tab.href);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/98 dark:bg-slate-900/98 backdrop-blur-lg border-t border-border/40 z-50 md:hidden">
      <div
        className="max-w-md mx-auto px-2"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-5 gap-0">
          {tabs.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="flex flex-col items-center justify-center py-2 min-h-[56px] active:bg-muted/50 transition-colors rounded-lg"
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
              >
                <div
                  className={`relative p-1.5 rounded-xl transition-all ${active ? 'bg-primary/15' : ''}`}
                >
                  <svg
                    className={`w-6 h-6 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={active ? 2.5 : 1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </div>
                <span
                  className={`text-[10px] mt-0.5 font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNavigation;
