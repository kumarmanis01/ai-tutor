'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function UnstickAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function unstickAll() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await fetch('/api/admin/jobs/unstick-all', { method: 'POST' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? 'Failed');
      setMsg(body.message ?? 'Done');
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={unstickAll}
        disabled={busy}
        className="text-[11px] px-3 py-1.5 rounded-lg border border-[#f5d193] bg-[#FAEEDA] text-[#633806] hover:bg-[#f5d193] disabled:opacity-50 min-h-[32px] transition-colors"
      >
        {busy ? 'Unsticking...' : 'Unstick all stuck jobs'}
      </button>
      {msg && <span className="text-[10px] text-[#1D9E75]">{msg}</span>}
      {err && <span className="text-[10px] text-[#E24B4A]">{err}</span>}
    </div>
  );
}
