'use client';

import React from 'react';
import { useRecommendations } from '@/hooks/useRecommendations';

interface SuggestedCard {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  color: string;
}

interface SuggestedContentProps { [key: string]: unknown }

const SuggestedContent: React.FC<SuggestedContentProps> = () => {
  const { items, loading, trackClick } = useRecommendations();
  const suggestions: SuggestedCard[] = items.map((i) => ({
    id: i.id,
    icon: '✨',
    title: i.title,
    subtitle: i.subject,
    color: 'bg-blue-50 border-blue-200',
  }));

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground px-1">
        Suggested For You
        <span className="text-muted-foreground text-sm ml-2">/ आपके लिए</span>
      </h2>

      {/* Horizontal Scrollable Cards */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-3 pb-2">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading suggestions…</div>
          ) : suggestions.length === 0 ? (
            <div className="p-3 border rounded">No suggestions right now</div>
          ) : suggestions.map((card) => (
            <div
              key={card.id}
              className={`flex-shrink-0 w-72 ${card.color} rounded-lg p-4 border border-border hover:shadow-md transition-shadow cursor-pointer bg-card`}
              onClick={() => trackClick(card.id)}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl flex-shrink-0">{card.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-foreground text-base">
                      {card.title}
                    </h3>
                    {card.badge && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium ml-2 flex-shrink-0">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="px-3 py-2 bg-primary text-primary-foreground rounded" onClick={() => trackClick(card.id)}>Start</button>
                    <button className="px-3 py-2 border rounded" onClick={() => console.log(`Mark Complete: ${card.id}`)}>Mark Complete</button>
                  </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {card.subtitle}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </section>
    );
  );
};

export default SuggestedContent;