"use client";
import { useEffect, useState } from 'react';

export type Recommendation = { id: string; type: string; subject: string; title: string; reasoning?: string; priority?: number };

export function useRecommendations() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/recommendations');
      const data = await res.json().catch(() => ({}));
      setItems(Array.isArray(data?.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }

  async function trackClick(id: string) {
    try { /* placeholder for server tracking */ } catch {}
  }

  useEffect(() => { refresh(); }, []);

  return { items, loading, refresh, trackClick };
}
