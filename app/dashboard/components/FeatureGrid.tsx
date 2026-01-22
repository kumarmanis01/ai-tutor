'use client';

import React from 'react';
import { useFeatureGrid } from '@/hooks/useFeatureGrid';

// Feature icons as components
const Icons = {
  practice: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  notes: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  doubts: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  video: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  quiz: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  default: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
};

const featureStyles = [
  { gradient: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800' },
  { gradient: 'from-purple-500 to-pink-500', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800' },
  { gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
  { gradient: 'from-orange-500 to-amber-500', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800' },
  { gradient: 'from-rose-500 to-red-500', bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800' },
  { gradient: 'from-indigo-500 to-violet-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800' },
];

const getIcon = (key: string) => {
  if (key.includes('practice') || key.includes('test')) return Icons.practice;
  if (key.includes('note')) return Icons.notes;
  if (key.includes('doubt') || key.includes('ask')) return Icons.doubts;
  if (key.includes('video')) return Icons.video;
  if (key.includes('quiz')) return Icons.quiz;
  return Icons.default;
};

interface FeatureGridProps { [key: string]: unknown }

const FeatureGrid: React.FC<FeatureGridProps> = () => {
  const { tiles, loading } = useFeatureGrid();

  // Loading skeleton
  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground px-1">
          Main Features
          <span className="text-muted-foreground text-sm ml-2">/ मुख्य सुविधाएं</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-4 border rounded-xl bg-card animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const features = tiles.map((t, idx) => ({
    id: t.key,
    icon: getIcon(t.key),
    title: t.title,
    subtitle: t.count ? `${t.count} items` : 'Explore →',
    style: featureStyles[idx % featureStyles.length],
  }));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-foreground">
          Main Features
          <span className="text-muted-foreground text-sm ml-2">/ मुख्य सुविधाएं</span>
        </h2>
        <button className="text-sm text-primary hover:underline">View All</button>
      </div>

      {features.length === 0 ? (
        <div className="p-6 border rounded-xl bg-card text-center">
          <div className="text-4xl mb-2">🎯</div>
          <p className="text-muted-foreground">No features available yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {features.map((feature) => (
            <button
              key={feature.id}
              className={`group relative p-4 border rounded-xl ${feature.style.bg} ${feature.style.border} hover:shadow-lg transition-all duration-300 hover:scale-[1.02] text-left overflow-hidden`}
            >
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.style.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              
              <div className="relative flex items-start gap-3">
                {/* Icon with gradient background */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.style.gradient} flex items-center justify-center text-white shadow-md flex-shrink-0`}>
                  {feature.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm leading-tight mb-1 truncate">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {feature.subtitle}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default FeatureGrid;