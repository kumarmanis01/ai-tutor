'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized bottom navigation with large tap targets and clear visual feedback.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/BottomNavigator.spec.ts
 *
 * EDIT LOG:
 * - 2025-01-22 | copilot | simplified design with better tap targets for mobile
 */
import React from 'react';

interface BottomNavigationProps {
  activeTab: 'home' | 'tests' | 'notes' | 'profile';
  onTabChange: (tab: 'home' | 'tests' | 'notes' | 'profile') => void;
}

const tabs = [
  { id: 'home' as const, label: 'Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { id: 'tests' as const, label: 'Practice', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'notes' as const, label: 'Notes', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'profile' as const, label: 'Me', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/98 dark:bg-slate-900/98 backdrop-blur-lg border-t border-border/40 z-50">
      <div className="max-w-md mx-auto px-4" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        <div className="grid grid-cols-4 gap-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="flex flex-col items-center justify-center py-2 min-h-[56px] active:bg-muted/50 transition-colors rounded-lg"
              >
                <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? 'bg-primary/15' : ''}`}>
                  <svg 
                    className={`w-6 h-6 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`} 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={isActive ? 2.5 : 1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </div>
                <span className={`text-[11px] mt-0.5 font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNavigation;