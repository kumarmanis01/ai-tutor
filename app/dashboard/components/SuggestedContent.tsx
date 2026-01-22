'use client';

import React from 'react';
import { useRecommendations } from '@/hooks/useRecommendations';

interface SuggestedCard {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  type: string;
}

// Card style variants
const cardStyles = [
  { gradient: 'from-blue-500 to-cyan-500', bg: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30' },
  { gradient: 'from-purple-500 to-pink-500', bg: 'bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30' },
  { gradient: 'from-emerald-500 to-teal-500', bg: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30' },
  { gradient: 'from-orange-500 to-amber-500', bg: 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30' },
];

// Icons for different content types
const ContentIcons: Record<string, React.ReactNode> = {
  notes: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  test: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  default: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
};

interface SuggestedContentProps { [key: string]: unknown }

const SuggestedContent: React.FC<SuggestedContentProps> = () => {
  const { items, loading, trackClick, trackCompleted } = useRecommendations();
  const suggestions: SuggestedCard[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    subtitle: i.subject,
    type: i.title.toLowerCase().includes('note') ? 'notes' : i.title.toLowerCase().includes('test') ? 'test' : 'default',
    badge: 'Recommended',
  }));

  // Loading skeleton
  if (loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground px-1">
          Suggested For You
          <span className="text-muted-foreground text-sm ml-2">/ आपके लिए</span>
        </h2>
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-3 pb-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-72 bg-card rounded-2xl p-5 border border-border animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-muted rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-foreground">
          Suggested For You
          <span className="text-muted-foreground text-sm ml-2">/ आपके लिए</span>
        </h2>
        <button className="text-sm text-primary hover:underline">See All</button>
      </div>

      {/* Horizontal Scrollable Cards */}
      <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
        <div className="flex gap-4 pb-2">
          {suggestions.length === 0 ? (
            <div className="flex-shrink-0 w-72 p-6 border rounded-2xl bg-card text-center">
              <div className="text-4xl mb-2">✨</div>
              <p className="text-sm text-muted-foreground">No suggestions right now</p>
              <p className="text-xs text-muted-foreground mt-1">Check back later!</p>
            </div>
          ) : (
            suggestions.map((card, idx) => {
              const style = cardStyles[idx % cardStyles.length];
              const icon = ContentIcons[card.type] || ContentIcons.default;
              
              return (
                <div
                  key={card.id}
                  className={`group flex-shrink-0 w-72 ${style.bg} rounded-2xl p-5 border border-border/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 cursor-pointer`}
                  onClick={() => trackClick(card.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      {icon}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Badge */}
                      {card.badge && (
                        <span className={`inline-flex items-center gap-1 text-[10px] bg-gradient-to-r ${style.gradient} text-white px-2 py-0.5 rounded-full font-medium mb-2`}>
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          {card.badge}
                        </span>
                      )}
                      
                      <h3 className="font-semibold text-foreground text-base leading-tight mb-1 line-clamp-2">
                        {card.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {card.subtitle}
                      </p>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="mt-4 flex gap-2">
                    <button 
                      className={`flex-1 px-4 py-2.5 bg-gradient-to-r ${style.gradient} text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-1.5`}
                      onClick={(e) => { e.stopPropagation(); trackClick(card.id); }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Start
                    </button>
                    <button 
                      className="px-3 py-2.5 bg-white/80 dark:bg-slate-800/80 border border-border/50 rounded-xl text-sm font-medium text-foreground hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      onClick={(e) => { e.stopPropagation(); trackCompleted(card.id); }}
                      title="Mark as completed"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Hide scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
};

export default SuggestedContent;