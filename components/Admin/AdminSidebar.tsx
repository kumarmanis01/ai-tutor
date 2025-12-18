'use client';

/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 *
 * ⚠️ DO NOT:
 * - Call LLMs directly
 * - Mutate jobs after creation
 * - Add progress tracking
 * - Use router.refresh() with SWR
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

const aiAdminLinks = [
  { href: '/admin/ai-dashboard', label: 'Dashboard' },
  { href: '/admin/content-engine/control-panel', label: 'AI Generation' },
  { href: '/admin/content-engine/moderation', label: 'Moderation' },
  { href: '/admin/content-engine/jobs', label: 'Jobs' },
  { href: '/admin/content-engine/workers', label: 'Workers' },
  { href: '/admin/content-engine/queue', label: 'Queue' },
  { href: '/admin/content-engine/redis', label: 'Redis' },
  { href: '/admin/system/metrics', label: 'System Metrics' },
  { href: '/admin/system/alerts', label: 'System Alerts' },
  { href: '/admin/content-engine/audit-logs', label: 'Audit Logs' },
  { href: '/admin/content-engine/rollbacks', label: 'Rollbacks' },
];

const generalAdminLinks = [
  { href: '/admin/users', label: 'User Management' },
  { href: '/admin/audit-logs', label: 'Audit Logs' },
  { href: '/admin/api-usage', label: 'API Usage Stats' },
  { href: '/admin/payments/success', label: 'Successful Payments' },
  { href: '/admin/payments/failed', label: 'Failed Payments' },
  { href: '/admin/charts/users', label: 'User Signups Chart' },
  { href: '/admin/charts/api-usage', label: 'API Usage Chart' },
  { href: '/admin/challenge', label: 'Challenges' },
  { href: '/admin/catalog', label: 'Catalog (Syllabus/Content)' },
  { href: '/admin/content-approval', label: 'Content Approval' },
];

function EnvironmentBadge() {
  return (
    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded mr-2">AI EdTech</span>
  );
}

function AdminProfile() {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-8 h-8 bg-gray-300 rounded-full" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Admin</span>
    </div>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:block w-72 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-0 flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <EnvironmentBadge />
        <AdminProfile />
      </div>
      {/* AI Control Tower Navigation */}
      <nav className="flex flex-col gap-2 mt-6 px-6">
        <div className="text-xs uppercase text-gray-500 font-semibold mb-2">AI Control Tower</div>
        {aiAdminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`py-2 px-3 rounded hover:bg-blue-100 dark:hover:bg-blue-900 ${
              pathname === link.href
                ? 'bg-blue-200 dark:bg-blue-700 font-semibold text-gray-900 dark:text-white'
                : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {/* General Admin Navigation */}
      <nav className="flex flex-col gap-2 mt-8 px-6">
        <div className="text-xs uppercase text-gray-500 font-semibold mb-2">General Admin</div>
        {generalAdminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`py-2 px-3 rounded hover:bg-blue-100 dark:hover:bg-blue-900 ${
              pathname === link.href
                ? 'bg-blue-200 dark:bg-blue-700 font-semibold text-gray-900 dark:text-white'
                : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {/* Optionally, add KPI cards, quick links, or other widgets here */}
    </aside>
  );
}
