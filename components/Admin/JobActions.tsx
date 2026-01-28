'use client'

import React, { useState } from 'react';
import { alerts } from '@/lib/alerts';
import { toast } from '@/lib/toast';

type Props = { jobId: string; status: string; onDone?: () => void };

export default function JobActions({ jobId, status, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const st = String(status || '').toUpperCase();
  const canRetry = ['FAILED', 'CANCELLED'].includes(st);
  const canCancel = st === 'PENDING' || st === 'RUNNING';

  async function performAction(action: 'retry' | 'cancel' | 'requeue') {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content-engine/jobs/${jobId}/${action}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        alerts.error("You don't have permission to perform this action.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const msg = body?.error || body?.message || 'Action failed';
        throw new Error(msg);
      }
      // success
      toast(`Action ${action} queued`);
      onDone?.();
    } catch (e: any) {
      const m = String(e?.message ?? e);
      setError(m);
      alerts.error(m, 'Action Failed');
    } finally {
      setLoading(false);
    }
  }

  function confirmAndRun(action: 'retry' | 'cancel' | 'requeue') {
    const messages: Record<typeof action, string> = {
      retry: 'This will create a new execution job attempt. Continue? This is an append-only operation.',
      cancel: 'This will cancel the job. This operation cannot be undone. Are you sure?',
      requeue: 'This will re-enqueue the hydrator/worker for this job. Continue?',
    };
    const confirmLabel = action === 'cancel' ? 'Confirm cancel' : action === 'requeue' ? 'Confirm requeue' : 'Confirm retry';
    const primary = action === 'cancel' ? 'Cancel job' : action === 'requeue' ? 'Requeue job' : 'Retry job';
    alerts.confirm(messages[action], () => performAction(action), confirmLabel, primary);
  }

  return (
    <div className="flex items-center gap-3">
      {canRetry && (
        <button className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50" onClick={() => confirmAndRun('retry')} disabled={loading}>
          {loading ? 'Working…' : 'Retry'}
        </button>
      )}

      {/* Requeue: for failed jobs, allow re-enqueueing the hydrator/worker */}
      {st === 'FAILED' && (
        <button className="px-3 py-1 bg-yellow-600 text-white rounded disabled:opacity-50" onClick={() => confirmAndRun('requeue')} disabled={loading}>
          {loading ? 'Working…' : 'Requeue'}
        </button>
      )}

      {canCancel && (
        <button className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50" onClick={() => confirmAndRun('cancel')} disabled={loading}>
          {loading ? 'Working…' : 'Cancel'}
        </button>
      )}

      {error && <div className="text-sm text-red-500">{error}</div>}
    </div>
  );
}
