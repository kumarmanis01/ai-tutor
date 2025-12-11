'use client';

import React from 'react';
import { useFeatureGrid } from '@/hooks/useFeatureGrid';

interface Feature {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  color: string;
}

interface FeatureGridProps { [key: string]: unknown }

const FeatureGrid: React.FC<FeatureGridProps> = () => {
  const features: Feature[] = [
    {
      id: '1',
      icon: '🧠',
      title: 'Doubt Solver',
      subtitle: 'Upload → Step-by-step solution',
      color: 'bg-purple-50 border-purple-200',
    },
    {
      id: '2',
      icon: '📚',
      title: 'Notes & Concepts',
      subtitle: 'NCERT/CBSE/State board',
      color: 'bg-blue-50 border-blue-200',
    },
    {
      id: '3',
      icon: '📝',
    const FeatureGrid: React.FC<FeatureGridProps> = () => {
      const { tiles, loading } = useFeatureGrid();
      const features = tiles.map(t => ({ id: t.key, title: t.title, subtitle: t.count ? `${t.count} items` : '', icon: '🧩', color: 'bg-indigo-50 border-indigo-200' }));
                  <span className="text-xs bg-primary px-2 py-1 rounded-full text-primary-foreground font-medium">
                    {feature.badge}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-foreground text-base mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading features…</div>
            ) : features.length === 0 ? (
              <div className="p-3 border rounded">No features available</div>
            ) : features.map((f) => (