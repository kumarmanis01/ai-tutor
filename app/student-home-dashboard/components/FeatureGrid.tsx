'use client';

import React from 'react';

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
      title: 'Practice Tests',
      subtitle: 'Auto-generate tests, instant score',
      color: 'bg-green-50 border-green-200',
    },
    {
      id: '4',
      icon: '🎤',
      title: 'Voice Tutor',
      subtitle: 'Ask a doubt using voice',
      badge: 'Beta',
      color: 'bg-orange-50 border-orange-200',
    },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground px-1">
        Main Features
        <span className="text-muted-foreground text-sm ml-2">/ मुख्य सुविधाएं</span>
      </h2>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        {features.map((feature) => (
          <div
            key={feature.id}
            className={`${feature.color} rounded-lg p-4 border hover:shadow-md transition-shadow cursor-pointer`}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-start justify-between mb-2">
                <div className="text-3xl">{feature.icon}</div>
                {feature.badge && (
                  <span className="text-xs bg-primary px-2 py-1 rounded-full text-primary-foreground font-medium">
                    {feature.badge}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-foreground text-base mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                {feature.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeatureGrid;