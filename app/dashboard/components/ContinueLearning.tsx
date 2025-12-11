'use client';

import React from 'react';
import { useContinueLearning } from '@/hooks/useContinueLearning';

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
  const { activities, loading, resumeActivity } = useContinueLearning();
  const learningItems: LearningItem[] = (activities || []).map((a) => ({
    id: a.id,
    title: a.activityType,
    subtitle: a.subject ?? 'General',
    actionText: 'Resume',
    icon: '🔄',
  }));

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground px-1">
        Continue Learning
        <span className="text-muted-foreground text-sm ml-2">/ सीखते रहें</span>
      </h2>

      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading activities…</div>
        ) : learningItems.length === 0 ? (
          <div className="p-4 border rounded">No resumable activities yet</div>
        ) : learningItems.map((item) => (
          <div
            key={item.id}
            className="bg-card rounded-lg shadow-card p-4 border border-border hover:shadow-md transition-shadow"
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
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-accent transition-colors flex-shrink-0" onClick={() => resumeActivity({ id: item.id, activityType: item.title })}>
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