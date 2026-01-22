'use client';

import React from 'react';
import { logger } from '@/lib/logger';
import { useParentMode } from '@/hooks/useParentMode';

interface ParentModeCardProps { [key: string]: unknown }

const ParentModeCard: React.FC<ParentModeCardProps> = () => {
  const { data, loading } = useParentMode();
  const isConnected = data.status === 'connected';
  
  const handleParentModeClick = () => {
    logger.add('Switching to Parent Mode', { className: 'ParentModeCard', methodName: 'handleParentModeClick' });
    // Navigate to parent dashboard
  };

  return (
    <section>
      <div 
        onClick={handleParentModeClick}
        className="group relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl p-5 border border-amber-200/50 dark:border-amber-800/30 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/10 to-orange-400/10 rounded-full blur-2xl -mr-10 -mt-10" />
        
        <div className="relative flex items-center gap-4">
          {/* Icon with gradient */}
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg group-hover:scale-105 transition-transform">
              👨‍👩‍👧
            </div>
            {/* Status indicator */}
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${isConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground text-base">
                Parent Dashboard
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isConnected ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
                {loading ? 'Checking…' : isConnected ? 'Connected' : 'Not linked'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              अभिभावक डैशबोर्ड • Track your child's progress
            </p>
            
            {/* Feature list */}
            <div className="flex flex-wrap gap-2">
              {[
                { icon: '📊', text: 'Track progress' },
                { icon: '📧', text: 'Weekly reports' },
                { icon: '🛡️', text: 'Safe learning' },
              ].map((feature, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-white/60 dark:bg-slate-800/60 px-2.5 py-1 rounded-full text-foreground/80">
                  <span>{feature.icon}</span>
                  {feature.text}
                </span>
              ))}
            </div>
          </div>

          {/* Arrow with gradient background */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-md">
            <svg 
              className="w-5 h-5 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ParentModeCard;