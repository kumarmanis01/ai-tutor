"use client";
import React, { useMemo } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type TelemetryPoint = { ts: string; value: number };
type SeriesRecord = { key: string; dimensions: any; points: TelemetryPoint[] };

// Explicit aggregation semantics per metric
const METRICS: Record<string, { agg: 'sum' | 'last' }> = {
  'queue.depth.value': { agg: 'last' },
  'queue.oldest_age_sec.value': { agg: 'last' },
  'workers.running.count': { agg: 'last' },
  'workers.stale.count': { agg: 'last' },
  'jobs.running.count': { agg: 'last' },
  'jobs.failed.count': { agg: 'sum' },
  'alerts.active.count': { agg: 'last' },
};

function seriesKeyBase(k: string) {
  return k.split('::')[0];
}

function indexPoints(points: TelemetryPoint[]) {
  const map: Record<string, number> = {};
  for (const p of points) map[p.ts] = p.value;
  return map;
}

export default function TelemetryView({ fromIso, toIso }: { fromIso: string; toIso: string }) {
  const keys = [
    'queue.depth.value',
    'queue.oldest_age_sec.value',
    'workers.running.count',
    'workers.stale.count',
    'jobs.running.count',
    'jobs.failed.count',
    'alerts.active.count',
  ].join(',');

  const { data, error } = useSWR(`/api/admin/system/telemetry?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&keys=${encodeURIComponent(keys)}&bucket=auto`, fetcher, { refreshInterval: 30000 });

  const samples = useMemo(() => {
    if (!data?.series) return [] as any[];
    const raw = data.series as Record<string, any>;
    const byKey: Record<string, SeriesRecord[]> = {};
    for (const seriesKey of Object.keys(raw)) {
      const item = raw[seriesKey];
      const base = seriesKeyBase(seriesKey);
      byKey[base] = byKey[base] ?? [];
      byKey[base].push({ key: item.key, dimensions: item.dimensions ?? null, points: item.points.map((p: any) => ({ ts: p.ts, value: Number(p.value) })) });
    }

    const tsSet = new Set<string>();
    for (const groups of Object.values(byKey)) for (const s of groups) for (const p of s.points) tsSet.add(p.ts);
    const allTs = Array.from(tsSet).sort();

    const samplesArr = allTs.map((ts) => {
      const sample: any = { timestamp: ts };
      for (const metric of Object.keys(byKey)) {
        const groups = byKey[metric] ?? [];
        if (groups.length === 0) continue;
        const agg = METRICS[metric]?.agg ?? 'sum';
        if (agg === 'sum') {
          sample[metric] = groups.reduce((acc, s) => {
            const idx = indexPoints(s.points);
            return acc + (idx[ts] ?? 0);
          }, 0);
        } else {
          let found: number | undefined;
          for (const s of groups) {
            const idx = indexPoints(s.points);
            if (idx[ts] !== undefined) {
              found = idx[ts];
              break;
            }
          }
          if (found === undefined) {
            sample[metric] = groups.reduce((acc, s) => acc + (indexPoints(s.points)[ts] ?? 0), 0);
          } else sample[metric] = found;
        }
      }
      return sample;
    });

    return samplesArr;
  }, [data]);

  if (error) return <div className="text-red-600">Failed to load telemetry</div>;
  if (!data) return <div>Loading telemetry…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-3 rounded shadow">
          <div className="text-xs text-gray-500">Queue depth</div>
          <div className="text-lg font-semibold">{samples[samples.length - 1]?.['queue.depth.value'] ?? '-'}</div>
        </div>
        <div className="bg-white p-3 rounded shadow">
          <div className="text-xs text-gray-500">Running jobs</div>
          <div className="text-lg font-semibold">{samples[samples.length - 1]?.['jobs.running.count'] ?? '-'}</div>
        </div>
        <div className="bg-white p-3 rounded shadow">
          <div className="text-xs text-gray-500">Failed jobs (range)</div>
          <div className="text-lg font-semibold">{samples.reduce((a, s) => a + (s['jobs.failed.count'] ?? 0), 0)}</div>
        </div>
        <div className="bg-white p-3 rounded shadow">
          <div className="text-xs text-gray-500">Active alerts</div>
          <div className="text-lg font-semibold">{samples[samples.length - 1]?.['alerts.active.count'] ?? 0}</div>
        </div>
      </div>

      <pre className="text-xs bg-gray-50 p-2 rounded">{/* JSON.stringify(seriesMap, null, 2) */}</pre>
    </div>
  );
}
