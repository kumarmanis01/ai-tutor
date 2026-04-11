'use client';
/**
 * FILE OBJECTIVE:
 * - Collapsible left-hand navigation sidebar for the admin shell.
 * - Receives badge counts (pending review, running jobs, failed jobs, safety alerts)
 *   as props so they are pre-fetched server-side.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created to fix missing module error in app/admin/layout.tsx
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface AdminSidebarProps {
  pendingReview: number;
  runningJobs: number;
  failedJobs: number;
  safetyAlerts: number;
}

interface NavItem {
  label: string;
  href: string;
  badge?: number;
  badgeVariant?: 'warn' | 'err';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Content', href: '/admin/content' },
  { label: 'Content Approval', href: '/admin/content-approval' },
  { label: 'Content Engine', href: '/admin/content-engine' },
  { label: 'Jobs', href: '/admin/jobs' },
  { label: 'Safety', href: '/admin/safety' },
  { label: 'Costs', href: '/admin/costs' },
  { label: 'Analytics', href: '/admin/analytics' },
  { label: 'Audit Logs', href: '/admin/audit-logs' },
  { label: 'System', href: '/admin/system' },
];

function Badge({ count, variant }: { count: number; variant: 'warn' | 'err' }) {
  if (count === 0) return null;
  const bg = variant === 'err' ? 'bg-[#E24B4A]' : 'bg-[#BA7517]';
  return (
    <span className={`${bg} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function AdminSidebar({ pendingReview, runningJobs, failedJobs, safetyAlerts }: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const itemsWithBadges: NavItem[] = NAV_ITEMS.map((item) => {
    if (item.href === '/admin/content-approval' && pendingReview > 0) {
      return { ...item, badge: pendingReview, badgeVariant: 'warn' };
    }
    if (item.href === '/admin/jobs' && (runningJobs > 0 || failedJobs > 0)) {
      return { ...item, badge: failedJobs > 0 ? failedJobs : runningJobs, badgeVariant: failedJobs > 0 ? 'err' : 'warn' };
    }
    if (item.href === '/admin/safety' && safetyAlerts > 0) {
      return { ...item, badge: safetyAlerts, badgeVariant: 'err' };
    }
    return item;
  });

  return (
    <aside
      className={`flex flex-col h-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-14' : 'w-52'
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#534AB7] to-[#3C3489] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[11px] font-bold leading-none">S</span>
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">Spinzy Admin</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {itemsWithBadges.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    isActive
                      ? 'bg-[#EEEDFE] text-[#534AB7] dark:bg-[#534AB7]/20 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="flex-1 truncate">{collapsed ? item.label.charAt(0) : item.label}</span>
                  {!collapsed && item.badge && item.badgeVariant && (
                    <Badge count={item.badge} variant={item.badgeVariant} />
                  )}
                  {collapsed && item.badge && item.badgeVariant && item.badge > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E24B4A] flex-shrink-0" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export default AdminSidebar;
