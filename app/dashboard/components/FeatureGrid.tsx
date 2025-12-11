'use client';

import React from 'react';
import { useFeatureGrid } from '@/hooks/useFeatureGrid';

// Removed unused Feature type to satisfy lint

interface FeatureGridProps { [key: string]: unknown }

const FeatureGrid: React.FC<FeatureGridProps> = () => {
  const { tiles, loading } = useFeatureGrid();
  const features = tiles.map((t) => ({ id: t.key, icon: '🧩', title: t.title, subtitle: t.count ? `${t.count} items` : '', color: 'bg-indigo-50 border-indigo-200' }));
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground px-1">
        Main Features
        <span className="text-muted-foreground text-sm ml-2">/ मुख्य सुविधाएं</span>
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading features…</div>
        ) : features.length === 0 ? (
          <div className="p-3 border rounded">No features available</div>
        ) : (
          features.map((feature) => (
            <div key={feature.id} className={`p-4 border rounded bg-card ${feature.color}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{feature.icon}</span>
                <div>
                  <div className="font-medium">{feature.title}</div>
                  <div className="text-xs text-muted-foreground">{feature.subtitle}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default FeatureGrid;