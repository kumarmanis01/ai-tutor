'use client';

import React from 'react';
import { useContinueLearning } from '@/hooks/useContinueLearning';

interface LearningItem {
  id: string;
  title: string;
  subtitle: string;
  progress?: number;
  actionText: string;
  type: string;
}

// Icons for different activity types
const ActivityIcons: Record<string, React.ReactNode> = {
  notes: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  test: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  quiz: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  default: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
};

const getActivityIcon = (type: string) => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('note')) return ActivityIcons.notes;
  if (lowerType.includes('test')) return ActivityIcons.test;
  if (lowerType.includes('quiz')) return ActivityIcons.quiz;
  return ActivityIcons.default;
};

const getActivityGradient = (type: string) => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('note')) return 'from-emerald-500 to-teal-500';
  if (lowerType.includes('test')) return 'from-purple-500 to-pink-500';
  if (lowerType.includes('quiz')) return 'from-orange-500 to-amber-500';
  return 'from-blue-500 to-cyan-500';
};

interface ContinueLearningProps { [key: string]: unknown }

const ContinueLearning: React.FC<ContinueLearningProps> = () => {
  const { activities, loading, resumeActivity } = useContinueLearning();
  const learningItems: LearningItem[] = (activities || []).map((a) => ({
    id: a.id,
    title: a.activityType,
    subtitle: a.subject ?? 'General',
    actionText: 'Resume',
    type: a.activityType,
    progress: Math.floor(Math.random() * 60) + 20, // Simulated progress - should come from actual data
  }));

  // Loading skeleton
  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground px-1">
          Continue Learning
          <span className="text-muted-foreground text-sm ml-2">/ सीखते रहें</span>
        </h2>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card rounded-xl shadow-sm p-4 border border-border animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-muted rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-2 bg-muted rounded w-full" />
                </div>
                <div className="w-20 h-10 bg-muted rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-foreground">
          Continue Learning
          <span className="text-muted-foreground text-sm ml-2">/ सीखते रहें</span>
        </h2>
        {learningItems.length > 0 && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
            {learningItems.length} pending
          </span>
        )}
      </div>

      <div className="space-y-3">
        {learningItems.length === 0 ? (
          <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl p-6 border border-primary/10 text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="font-semibold text-foreground mb-1">Ready to Start?</h3>
            <p className="text-sm text-muted-foreground">Begin a lesson or test to track your progress here</p>
          </div>
        ) : (
          learningItems.map((item) => (
            <div
              key={item.id}
              className="group bg-card rounded-xl shadow-sm p-4 border border-border hover:shadow-md hover:border-primary/30 transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                {/* Icon with gradient */}
                <div className={`w-14 h-14 bg-gradient-to-br ${getActivityGradient(item.type)} rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  {getActivityIcon(item.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-foreground text-base truncate pr-2">
                      {item.title}
                    </h3>
                    {item.progress && (
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">
                        {item.progress}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mb-2">
                    {item.subtitle}
                  </p>
                  
                  {/* Progress bar */}
                  {item.progress && (
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${getActivityGradient(item.type)} transition-all duration-500`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <button
                  onClick={() => resumeActivity({ id: item.id, activityType: item.title })}
                  className={`px-4 py-2.5 bg-gradient-to-r ${getActivityGradient(item.type)} text-white rounded-xl font-medium text-sm hover:shadow-lg transition-all duration-300 flex-shrink-0 flex items-center gap-1.5`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {item.actionText}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default ContinueLearning;