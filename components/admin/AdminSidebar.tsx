'use client';

/**
 * FILE OBJECTIVE:
 * - Admin sidebar navigation component showing key admin sections and badges.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/AdminSidebar.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/AdminSidebar.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created to fix missing module error in app/admin/layout.tsx
 * - 2026-04-15 | copilot | add required file header and EDIT LOG entry for repo compliance
 * - 2026-05-13T00:00:00Z | copilot | add Event Analytics nav item to admin sidebar
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminSidebarProps {
  pendingReview: number;
  runningJobs: number;
  failedJobs: number;
  safetyAlerts: number;
  flaggedQuestions: number;
}

interface NavItemDef {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeVariant?: 'error' | 'warn';
}

// ---------------------------------------------------------------------------
// Inline SVG icons (no external dependency)
// ---------------------------------------------------------------------------

const IconGrid = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 9a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm9-9a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 9a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
  </svg>
);

const IconLines = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 6h16M4 10h16M4 14h10M4 18h7" />
  </svg>
);

const IconDoc = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconClock = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconPerson = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const IconPeople = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IconChart = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconCoin = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconPulse = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const IconShield = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IconBell = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-3 pt-4 pb-1 select-none">
      {label}
    </p>
  );
}

function NavItem({
  href,
  icon,
  label,
  badge,
  badgeVariant = 'error',
  isActive,
}: NavItemDef & { isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-2 py-1.5 mx-1 rounded-lg text-[11px] transition-colors ${
        isActive
          ? 'bg-[#EEEDFE] text-[#3C3489] font-medium'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <span className={isActive ? 'text-[#534AB7]' : 'text-gray-400 dark:text-gray-500'}>
        {icon}
      </span>
      <span className="flex-1 leading-none">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white leading-none ${
            badgeVariant === 'warn' ? 'bg-[#BA7517]' : 'bg-[#E24B4A]'
          }`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminSidebar({
  pendingReview,
  runningJobs,
  failedJobs,
  safetyAlerts,
  flaggedQuestions,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  // Jobs badge: total of currently running + failed jobs that need attention.
  // runningJobs and failedJobs are separate counts from the layout so there is
  // no double-counting.
  const jobsBadge = runningJobs + failedJobs;

  return (
    <aside className="hidden md:flex flex-col w-52 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <span className="text-xl leading-none" role="img" aria-label="Spinzy owl">
          🦉
        </span>
        <span className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
          Spinzy
        </span>
        <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#EEEDFE] text-[#3C3489]">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 pb-6">
        {/* OVERVIEW */}
        <SectionLabel label="Overview" />
        <NavItem
          href="/admin"
          icon={<IconGrid />}
          label="Dashboard"
          isActive={isActive('/admin')}
        />

        {/* CONTENT */}
        <SectionLabel label="Content" />
        <NavItem
          href="/admin/content"
          icon={<IconLines />}
          label="Coverage & Hydrate"
          isActive={isActive('/admin/content')}
        />
        <NavItem
          href="/admin/content-approval"
          icon={<IconDoc />}
          label="Content Review"
          badge={pendingReview}
          isActive={isActive('/admin/content-approval')}
        />
        <NavItem
          href="/admin/questions"
          icon={<IconDoc />}
          label="Flagged Questions"
          badge={flaggedQuestions}
          isActive={isActive('/admin/questions')}
        />
        <NavItem
          href="/admin/jobs"
          icon={<IconClock />}
          label="Jobs"
          badge={jobsBadge}
          badgeVariant={failedJobs > 0 ? 'error' : 'warn'}
          isActive={isActive('/admin/jobs')}
        />

        {/* USERS */}
        <SectionLabel label="Users" />
        <NavItem
          href="/admin/users"
          icon={<IconPerson />}
          label="Students"
          isActive={isActive('/admin/users')}
        />
        <NavItem
          href="/admin/parents"
          icon={<IconPeople />}
          label="Parents"
          isActive={isActive('/admin/parents')}
        />

        {/* ANALYTICS */}
        <SectionLabel label="Analytics" />
        <NavItem
          href="/admin/learning-analytics"
          icon={<IconChart />}
          label="Learning Analytics"
          isActive={isActive('/admin/learning-analytics')}
        />
        <NavItem
          href="/admin/analytics/events"
          icon={<IconChart />}
          label="Event Analytics"
          isActive={isActive('/admin/analytics/events')}
        />
        <NavItem
          href="/admin/costs"
          icon={<IconCoin />}
          label="Costs & Usage"
          isActive={isActive('/admin/costs')}
        />

        {/* SYSTEM */}
        <SectionLabel label="System" />
        <NavItem
          href="/admin/system/health"
          icon={<IconPulse />}
          label="System Health"
          isActive={isActive('/admin/system/health')}
        />
        <NavItem
          href="/admin/safety"
          icon={<IconShield />}
          label="Safety & Alerts"
          badge={safetyAlerts}
          isActive={isActive('/admin/safety')}
        />
        <NavItem
          href="/admin/notifications"
          icon={<IconBell />}
          label="Notifications"
          isActive={isActive('/admin/notifications')}
        />
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        <p className="text-[9px] text-gray-400 dark:text-gray-600">Spinzy Academy v2</p>
      </div>
    </aside>
  );
}

export default AdminSidebar
