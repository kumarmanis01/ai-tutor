'use client';

/**
 * FILE OBJECTIVE:
 * - Render the admin topbar with service status chips that distinguish auth failures from infrastructure outages.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/AdminTopbar.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-01T00:00:00Z | copilot | map 403 status checks to auth-required chips for redis and worker
 */

import React, { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminTopbarProps {
  title: string;
  runningJobs?: number;
  children?: React.ReactNode;
}

type ChipVariant = 'ok' | 'warn' | 'err' | 'default';

// ---------------------------------------------------------------------------
// Chip sub-component
// ---------------------------------------------------------------------------

function Chip({ label, variant = 'default' }: { label: string; variant?: ChipVariant }) {
  const dotColor =
    variant === 'ok'
      ? 'bg-[#1D9E75]'
      : variant === 'warn'
        ? 'bg-[#BA7517]'
        : variant === 'err'
          ? 'bg-[#E24B4A]'
          : 'bg-[#1D9E75]';

  return (
    <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 whitespace-nowrap">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Redis status chip -- fetches lazily on mount
// ---------------------------------------------------------------------------

function RedisStatusChip() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'down' | 'forbidden'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/content-engine/redis')
      .then((r) => {
        if (cancelled) return;
        if (r.status === 403) {
          setStatus('forbidden');
          return;
        }
        setStatus(r.ok ? 'ok' : 'down');
      })
      .catch(() => {
        if (!cancelled) setStatus('down');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') return null;
  return (
    <Chip
      label={status === 'ok' ? 'Redis OK' : status === 'forbidden' ? 'Redis auth required' : 'Redis down'}
      variant={status === 'ok' ? 'ok' : status === 'forbidden' ? 'warn' : 'err'}
    />
  );
}

// ---------------------------------------------------------------------------
// Worker status chip -- polls /api/admin/system/worker-status
// ---------------------------------------------------------------------------

function WorkerStatusChip() {
  const [status, setStatus] = useState<'loading' | 'running' | 'down' | 'forbidden'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/system/worker-status')
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 403) {
          setStatus('forbidden');
          return;
        }
        if (!r.ok) {
          setStatus('down');
          return;
        }

        const d = await r.json();
        if (!cancelled) {
          setStatus(d.alive ? 'running' : 'down');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('down');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') return null;

  return (
    <Chip
      label={
        status === 'running'
          ? 'Worker running'
          : status === 'forbidden'
            ? 'Worker auth required'
            : 'Worker down'
      }
      variant={status === 'running' ? 'ok' : status === 'forbidden' ? 'warn' : 'err'}
    />
  );
}

// ---------------------------------------------------------------------------
// Running jobs chip -- self-fetches active job count
// ---------------------------------------------------------------------------

function RunningJobsChip() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/jobs/active-count')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCount(d.count ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === 0) return null;
  return <Chip label={`${count} job${count === 1 ? '' : 's'} running`} variant="warn" />;
}

// ---------------------------------------------------------------------------
// Admin avatar stub
// ---------------------------------------------------------------------------

function AdminAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#534AB7] to-[#3C3489] flex items-center justify-center flex-shrink-0">
      <span className="text-white text-[10px] font-bold leading-none">A</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminTopbar({ title, runningJobs, children }: AdminTopbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
      {/* Left: page title */}
      <h1 className="text-[15px] font-medium text-gray-900 dark:text-white truncate">{title}</h1>

      {/* Right: status chips + optional action buttons + avatar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Chip label="Production live" variant="ok" />
        <RedisStatusChip />
        <WorkerStatusChip />
        {/* If caller passes runningJobs explicitly, use that; otherwise self-fetch */}
        {runningJobs !== undefined ? (
          runningJobs > 0 ? (
            <Chip
              label={`${runningJobs} job${runningJobs === 1 ? '' : 's'} running`}
              variant="warn"
            />
          ) : null
        ) : (
          <RunningJobsChip />
        )}
        {children}
        <AdminAvatar />
      </div>
    </div>
  );
}
