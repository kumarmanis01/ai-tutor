/**
 * FILE OBJECTIVE:
 * - A4.1: AnalyticsDashboardClient -- executive dashboard with time filter,
 *   KPI metric cards, top topics table, and auto-refresh every 5 minutes.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/analytics/AnalyticsDashboardClient.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A4.1 AnalyticsDashboardClient component
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MetricCard } from '@/components/admin/analytics/MetricCard';
import { TimeFilter } from '@/components/admin/analytics/TimeFilter';
import type { Period } from '@/components/admin/analytics/TimeFilter';
import { logger } from '@/lib/logger';

type MetricValue = {
  value: number;
  suffix?: string;
  trend?: string | null;
  label: string;
  sparkline?: number[];
};

type Metrics = {
  totalAccounts: MetricValue;
  activeUsers: MetricValue;
  newRegistrations: MetricValue;
  premiumConversion: MetricValue;
  contentGenerated: MetricValue;
  approvalRate: MetricValue;
  flaggedContent: MetricValue;
};

type TopTopic = {
  topic: string;
  count: number;
};

type DashboardData = {
  period: string;
  start: string;
  end: string;
  metrics: Metrics;
  topTopics: TopTopic[];
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * A4.1 -- Executive analytics dashboard client.
 */
export function AnalyticsDashboardClient() {
  const [period, setPeriod] = useState<Period>('week');
  const [customStart, setCustomStart] = useState<string | undefined>();
  const [customEnd, setCustomEnd] = useState<string | undefined>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = useCallback(async (p: Period, start?: string, end?: string, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const params = new URLSearchParams({ period: p });
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const res = await fetch(`/api/admin/analytics/dashboard?${params.toString()}`);
      const json = (await res.json()) as { data?: DashboardData; cached?: boolean };
      if (res.ok && json.data) {
        setData(json.data);
        setIsCached(json.cached ?? false);
        setLastRefreshed(new Date());
      }
    } catch (err: unknown) {
      logger.error('AnalyticsDashboardClient: fetchDashboard failed', { period: p, error: err });
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // Fetch on period change
  useEffect(() => {
    void fetchDashboard(period, customStart, customEnd);
    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(() => {
      void fetchDashboard(period, customStart, customEnd, true);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [period, customStart, customEnd, fetchDashboard]);

  function handlePeriodChange(p: Period, start?: string, end?: string) {
    setPeriod(p);
    setCustomStart(start);
    setCustomEnd(end);
  }

  const metrics = data?.metrics;

  return (
    <div>
      {/* Period filter */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <TimeFilter
          value={period}
          customStart={customStart}
          customEnd={customEnd}
          onChange={handlePeriodChange}
        />
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-gray-400">
              {isCached ? 'Cached · ' : ''}Last updated: {lastRefreshed.toLocaleTimeString('en-IN')}
            </span>
          )}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void fetchDashboard(period, customStart, customEnd)}
            className="min-h-[36px] rounded-xl border border-gray-200 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Metric cards grid */}
      {isLoading && !data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={idx} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <MetricCard
            label={metrics.totalAccounts.label}
            value={metrics.totalAccounts.value}
            trend={metrics.totalAccounts.trend}
            sparkline={metrics.totalAccounts.sparkline}
          />
          <MetricCard
            label={metrics.activeUsers.label}
            value={metrics.activeUsers.value}
            trend={metrics.activeUsers.trend}
            sparkline={metrics.activeUsers.sparkline}
          />
          <MetricCard
            label={metrics.newRegistrations.label}
            value={metrics.newRegistrations.value}
            trend={metrics.newRegistrations.trend}
            sparkline={metrics.newRegistrations.sparkline}
          />
          <MetricCard
            label={metrics.premiumConversion.label}
            value={metrics.premiumConversion.value}
            suffix={metrics.premiumConversion.suffix}
            trend={metrics.premiumConversion.trend}
            sparkline={metrics.premiumConversion.sparkline}
          />
          <MetricCard
            label={metrics.contentGenerated.label}
            value={metrics.contentGenerated.value}
            trend={metrics.contentGenerated.trend}
            sparkline={metrics.contentGenerated.sparkline}
          />
          <MetricCard
            label={metrics.approvalRate.label}
            value={metrics.approvalRate.value}
            suffix={metrics.approvalRate.suffix}
            trend={metrics.approvalRate.trend}
            sparkline={metrics.approvalRate.sparkline}
          />
          <MetricCard
            label={metrics.flaggedContent.label}
            value={metrics.flaggedContent.value}
            trend={metrics.flaggedContent.trend}
            sparkline={metrics.flaggedContent.sparkline}
          />
        </div>
      ) : null}

      {/* Top 5 Topics */}
      {data?.topTopics && data.topTopics.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-gray-800">
            Top 5 Requested Topics
          </h2>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {data.topTopics.map((t, idx) => {
              const maxCount = data.topTopics[0]?.count ?? 1;
              const barPct = Math.round((t.count / maxCount) * 100);
              return (
                <div
                  key={t.topic}
                  className={`flex items-center gap-4 px-5 py-4 ${
                    idx < data.topTopics.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <span className="w-6 text-sm font-bold text-gray-400">#{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{t.topic}</p>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-[#534AB7]/60"
                        style={{ width: `${barPct}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[#534AB7]">
                    {t.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsDashboardClient;
