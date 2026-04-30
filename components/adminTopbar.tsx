'use client';

/**
 * FILE OBJECTIVE:
 * - Lightweight admin topbar for admin routes (brand + nav + user quick actions).
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/adminTopbar.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-30T00:00:00Z | copilot | created admin topbar
 */

import React from 'react';
import { useSession } from 'next-auth/react';

export interface AdminTopbarProps {
  title?: string;
  runningJobs?: number;
  children?: React.ReactNode;
}

export function AdminTopbar({ title, runningJobs, children }: AdminTopbarProps) {
  const { data: _session } = useSession();

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
      <h1 className="text-[15px] font-medium text-gray-900 dark:text-white truncate">{title ?? 'Admin'}</h1>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Jobs: {runningJobs ?? '—'}</span>
        {children}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#534AB7] to-[#3C3489] flex items-center justify-center">
          <span className="text-white text-[10px] font-bold leading-none">A</span>
        </div>
      </div>
    </div>
  );
}

export default AdminTopbar;
