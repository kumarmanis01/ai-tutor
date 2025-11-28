'use client';

import React from 'react';

interface ParentModeCardProps { [key: string]: unknown }

const ParentModeCard: React.FC<ParentModeCardProps> = () => {
  const handleParentModeClick = () => {
    console.log('Switching to Parent Mode');
    // Navigate to parent dashboard
  };

  return (
    <section>
      <div 
        onClick={handleParentModeClick}
        className="bg-white rounded-lg p-4 border border-border hover:shadow-md transition-shadow cursor-pointer"
      >
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
            👨‍👩‍👧
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-base mb-1">
              Parent Dashboard
              <span className="text-muted-foreground text-sm ml-2">/ अभिभावक डैशबोर्ड</span>
            </h3>
            <ul className="space-y-1">
              <li className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-success">✓</span>
                Track progress
              </li>
              <li className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-success">✓</span>
                Weekly report
              </li>
              <li className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-success">✓</span>
                Safe learning environment
              </li>
            </ul>
          </div>

          {/* Arrow */}
          <svg 
            className="w-6 h-6 text-muted-foreground flex-shrink-0" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </section>
  );
};

export default ParentModeCard;