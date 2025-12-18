"use client";
import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import MetricsCharts from '@/components/Admin/MetricsCharts';
import AlertOverlay from '@/components/Admin/AlertOverlay';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function MetricsPage() {
  const [rangeMinutes, setRangeMinutes] = useState(60);
  const to = new Date();
  const from = new Date(Date.now() - rangeMinutes * 60 * 1000);
  const isoFrom = from.toISOString();
  const isoTo = to.toISOString();

  const { data, error } = useSWR(`/api/admin/system/metrics?from=${encodeURIComponent(isoFrom)}&to=${encodeURIComponent(isoTo)}&interval=60`, fetcher, { refreshInterval: 30000 });

  const samples = useMemo(() => {
    if (!data) return [];
    // samples might be health snapshots or persisted rows
    if (Array.isArray(data.samples)) return data.samples;
    if (Array.isArray(data)) return data;
    return [];
  }, [data]);

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

      {samples.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Overall</div>
                <div className="text-lg font-semibold">{samples[samples.length - 1].overall ?? samples[samples.length - 1].overall}</div>
              </div>
              <div className="text-sm text-gray-500">Last sample: {new Date(samples[samples.length - 1].timestamp || samples[samples.length - 1].timestamp).toLocaleString()}</div>
            </div>
          </div>

          <MetricsCharts samples={samples} />
        </div>
      )}
    </div>
  );
}
