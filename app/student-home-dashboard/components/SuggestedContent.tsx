'use client';

import React from 'react';

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
  const suggestions: SuggestedCard[] = [
    {
      id: '1',
      icon: '📘',
      title: 'NCERT Chapter Notes',
      subtitle: 'Class 6 → Chapter 4 → Simple Equations',
      color: 'bg-blue-50 border-blue-200',
    },
    {
      id: '2',
      icon: '📝',
      title: 'Daily 10-Minute Practice',
      subtitle: '8-10 auto-generated questions',
      color: 'bg-green-50 border-green-200',
    },
    {
      id: '3',
      icon: '🎯',
      title: 'Weak Areas Identified',
      subtitle: 'Math: Fractions - 62% · Science: Circuit - 54%',
      badge: 'Needs Work',
      color: 'bg-amber-50 border-amber-200',
    },
    {
      id: '4',
      icon: '🔥',
      title: "Today's Challenge",
      subtitle: '5 mixed questions for streaks',
      badge: 'Popular',
      color: 'bg-orange-50 border-orange-200',
    },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground px-1">
        Suggested For You
        <span className="text-muted-foreground text-sm ml-2">/ आपके लिए</span>
      </h2>

      {/* Horizontal Scrollable Cards */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-3 pb-2">
          {suggestions.map((card) => (
            <div
              key={card.id}
              className={`flex-shrink-0 w-72 ${card.color} rounded-lg p-4 border border-border hover:shadow-md transition-shadow cursor-pointer bg-card`}
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
};

export default SuggestedContent;