"use client";
import { useEffect, useState } from 'react';

export type FeatureTile = { key: string; title: string; enabled: boolean; count?: number };

export function useFeatureGrid() {
  const [tiles, setTiles] = useState<FeatureTile[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/feature-grid');
      const data = await res.json().catch(() => ({}));
      setTiles(Array.isArray(data?.tiles) ? data.tiles : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  return { tiles, loading, refresh };
}
