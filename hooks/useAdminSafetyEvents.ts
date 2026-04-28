'use client';

import useSWR from 'swr';

export type AdminSafetyEvent = {
  id: string;
  triggerType: string;
  sessionId: string | null;
  turnId: string | null;
  studentId: string;
  severity: string;
  inputPreview: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
};

export type AdminSafetyEventsResponse = {
  events: AdminSafetyEvent[];
  total: number;
  page: number;
  totalPages: number;
};

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Request failed');
  return data as AdminSafetyEventsResponse;
};

export function useAdminSafetyEvents(params: {
  page: number;
  limit: number;
  category?: string;
  severity?: string;
  studentId?: string;
  from?: string;
  to?: string;
  resolved?: boolean;
}) {
  const sp = new URLSearchParams();
  sp.set('page', String(params.page));
  sp.set('limit', String(params.limit));
  if (params.category) sp.set('category', params.category);
  if (params.severity) sp.set('severity', params.severity);
  if (params.studentId) sp.set('studentId', params.studentId);
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  if (typeof params.resolved === 'boolean') sp.set('resolved', params.resolved ? 'true' : 'false');

  const key = `/api/admin/safety-events?${sp.toString()}`;
  const { data, error, isLoading, mutate } = useSWR<AdminSafetyEventsResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
  });

  return {
    data,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: mutate,
  };
}
