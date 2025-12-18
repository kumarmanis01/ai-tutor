"use client";
import React, { useState } from 'react';
import useSWR from 'swr';
import TelemetryView from '@/components/Admin/TelemetryView';
import AlertOverlay from '@/components/Admin/AlertOverlay';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function MetricsPage() {
  const [rangeMinutes, setRangeMinutes] = useState(60);
  const to = new Date();
  const from = new Date(Date.now() - rangeMinutes * 60 * 1000);
  const isoFrom = from.toISOString();
  const isoTo = to.toISOString();

  const { data, error } = useSWR(`/api/admin/system/telemetry?from=${encodeURIComponent(isoFrom)}&to=${encodeURIComponent(isoTo)}&keys=queue.depth.value,queue.oldest_age_sec.value,workers.running.count,workers.stale.count,jobs.running.count,jobs.failed.count,alerts.active.count&bucket=auto`, fetcher, { refreshInterval: 30000 });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <AlertOverlay />
      <h1 className="text-2xl font-semibold mb-4">System Metrics</h1>

      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm text-gray-600">Range (minutes)</label>
        <select value={rangeMinutes} onChange={(e) => setRangeMinutes(Number(e.target.value))} className="border px-2 py-1">
          <option value={15}>15</option>
          <option value={30}>30</option>
          <option value={60}>60</option>
          <option value={240}>4h</option>
        </select>
      </div>

      {error && <div className="text-red-600">Failed to load metrics.</div>}
      {!data && <div>Loading metrics…</div>}

      <TelemetryView fromIso={isoFrom} toIso={isoTo} />
    </div>
  );
}
