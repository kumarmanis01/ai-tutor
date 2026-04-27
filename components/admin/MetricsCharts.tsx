"use client";
import React from 'react';

function toPath(points: Array<[number, number]>) {
  if (points.length === 0) return '';
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
}

export function Sparkline({ data, width = 220, height = 40, color = '#3b82f6' }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (!data || data.length === 0) return <div className="text-xs text-gray-500">no data</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points: Array<[number, number]> = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return [x, y];
  });
  const path = toPath(points);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MetricsCharts({ samples }: { samples: any[] }) {
  const queueDepth = samples.map((s) => s.queueDepth ?? (s.queue?.depth ?? 0));
  const dbLatency = samples.map((s) => s.dbLatencyMs ?? s.dependencies?.database?.latencyMs ?? 0);
  const redisLatency = samples.map((s) => s.redisLatencyMs ?? s.dependencies?.redis?.latencyMs ?? 0);
  // keep derived series minimal; unused series removed

  const last = samples[samples.length - 1] ?? {};

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded shadow p-4">
          <div className="text-xs text-gray-500">Queue depth</div>
          <div className="mt-2 flex items-center gap-4">
            <div className="flex-1"><Sparkline data={queueDepth} /></div>
            <div className="text-lg font-semibold">{last.queueDepth ?? last.queue?.depth ?? 0}</div>
          </div>
        </div>

        <div className="bg-white rounded shadow p-4">
          <div className="text-xs text-gray-500">Oldest job age (s)</div>
          <div className="mt-2 text-lg font-semibold">{last.queueOldestJobAge ?? last.queue?.oldestJobAgeSec ?? '-'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded shadow p-4">
          <div className="text-xs text-gray-500">DB latency (ms)</div>
          <div className="mt-2"><Sparkline data={dbLatency} color="#10b981" /></div>
        </div>
        <div className="bg-white rounded shadow p-4">
          <div className="text-xs text-gray-500">Redis latency (ms)</div>
          <div className="mt-2"><Sparkline data={redisLatency} color="#ef4444" /></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded shadow p-4">
          <div className="text-xs text-gray-500">Workers running</div>
          <div className="mt-2 text-lg font-semibold">{last.workersRunning ?? last.workers?.running ?? 0}</div>
        </div>
        <div className="bg-white rounded shadow p-4">
          <div className="text-xs text-gray-500">Jobs pending</div>
          <div className="mt-2 text-lg font-semibold">{last.jobsPending ?? last.jobs?.pending ?? 0}</div>
        </div>
        <div className="bg-white rounded shadow p-4">
          <div className="text-xs text-gray-500">Jobs failed (5m)</div>
          <div className="mt-2 text-lg font-semibold">{last.jobsFailedLast5m ?? last.jobs?.failedLast5m ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
