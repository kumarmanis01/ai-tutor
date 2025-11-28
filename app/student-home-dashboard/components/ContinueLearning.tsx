'use client';

import React from 'react';

interface LearningItem {
  id: string;
  title: string;
  subtitle: string;
  progress?: number;
  actionText: string;
  icon: string;
}

interface ContinueLearningProps { [key: string]: unknown }

const ContinueLearning: React.FC<ContinueLearningProps> = () => {
  const learningItems: LearningItem[] = [
    {
      id: '1',
      title: 'Fractions',
      subtitle: 'NCERT Class 6',
      progress: 65,
      actionText: 'Continue',
      icon: '📐',
    },
    {
      id: '2',
      title: 'Photosynthesis Doubt',
      subtitle: 'Science Chapter 7',
      actionText: 'View Answer',
      icon: '🌱',
    },
    {
      id: '3',
      title: 'Last Test: Algebra Basics',
      subtitle: 'Score: 72% · Improve Now',
      actionText: 'Review',
      icon: '📝',
    },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground px-1">
        Continue Learning
        <span className="text-muted-foreground text-sm ml-2">/ सीखते रहें</span>
      </h2>

      <div className="space-y-3">
        {learningItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-lg shadow-card p-4 border border-border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                {item.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-base truncate">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {item.subtitle}
                </p>
                {item.progress && (
                  <div className="mt-2">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-success h-2 rounded-full transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 inline-block">
                      {item.progress}% complete
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-accent transition-colors flex-shrink-0">
                {item.actionText}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ContinueLearning;