'use client';

import React, { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SafetyAlertData {
  id: string;
  kind: 'distress' | 'flag';
  triggerType: string;
  severity: string;
  studentId: string;
  sessionId: string | null;
  inputPreview: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Single alert row
// ---------------------------------------------------------------------------

function AlertRow({
  alert,
  onResolved,
}: {
  alert: SafetyAlertData;
  onResolved: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isHigh = alert.severity === 'HIGH' || alert.severity === 'CRITICAL';
  const dotColor = isHigh ? 'bg-[#E24B4A]' : 'bg-[#BA7517]';
  const rowBg = isHigh ? 'bg-[#FCEBEB]/40' : 'bg-[#FAEEDA]/30';

  async function resolve() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/safety/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alert.id, kind: alert.kind }),
      });
      if (!r.ok) throw new Error('Failed');
      onResolved(alert.id);
    } catch {
      setErr('Could not resolve');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-800 ${rowBg}`}
    >
      <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              isHigh ? 'bg-[#FCEBEB] text-[#791F1F]' : 'bg-[#FAEEDA] text-[#633806]'
            }`}
          >
            {alert.severity}
          </span>
          <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
            {alert.triggerType}
          </span>
          <span className="text-[10px] text-gray-400">
            {new Date(alert.createdAt).toLocaleString()}
          </span>
        </div>

        {alert.inputPreview && (
          <p
            className="text-[11px] text-gray-500 mt-1 truncate max-w-[480px]"
            title={alert.inputPreview}
          >
            {alert.inputPreview}
          </p>
        )}

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {err && <span className="text-[10px] text-[#E24B4A]">{err}</span>}

          {alert.kind === 'distress' && alert.sessionId && (
            <a
              href={`/admin/content-engine/jobs/${alert.sessionId}`}
              className="inline-flex text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[28px] items-center"
            >
              Review session
            </a>
          )}

          <button
            onClick={resolve}
            disabled={busy}
            className="inline-flex text-[10px] px-2 py-1 rounded border border-[#c8e6c9] bg-[#EAF3DE] text-[#27500A] hover:bg-[#d9edd9] disabled:opacity-50 min-h-[28px] items-center transition-colors"
          >
            {busy ? 'Resolving...' : alert.kind === 'distress' ? 'Mark resolved' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function SafetyAlertList({ alerts }: { alerts: SafetyAlertData[] }) {
  const [items, setItems] = useState(alerts);

  function removeResolved(id: string) {
    setItems((prev) => prev.filter((a) => a.id !== id));
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-2xl mb-2">✓</p>
        <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
          No unresolved alerts
        </p>
        <p className="text-[11px] text-gray-400 mt-1">All safety events have been addressed</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((alert) => (
        <AlertRow key={alert.id} alert={alert} onResolved={removeResolved} />
      ))}
    </div>
  );
}
