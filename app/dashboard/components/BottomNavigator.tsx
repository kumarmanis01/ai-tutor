'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized bottom navigation with large tap targets and clear visual feedback.
 * - Updated IA: Home, Notes, Practice, Doubts, Profile (per PRD).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/BottomNavigator.spec.ts
 *
 * EDIT LOG:
 * - 2025-01-22 | copilot | simplified design with better tap targets for mobile
 * - 2026-02-04 | claude | added Doubts tab, reordered per PRD IA
 */
import React from 'react';

/** Navigation tab types matching PRD information architecture */
export type TabId = 'home' | 'notes' | 'tests' | 'doubts' | 'profile';

interface BottomNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

/**
 * Navigation tabs following PRD IA:
 * 1. Home - Landing with greeting, today's learning, continue, weekly progress
 * 2. Notes - Chapter/topic notes with language/difficulty toggles
 * 3. Practice - Quick practice, chapter tests, revision tests
 * 4. Doubts - Ask AI questions (child-safe, encouraging)
 * 5. Profile - Name, grade, board, preferences, learning goals
 */
const tabs = [
  { id: 'home' as const, label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'notes' as const, label: 'Notes', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'tests' as const, label: 'Practice', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'doubts' as const, label: 'Doubts', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'profile' as const, label: 'Me', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/98 dark:bg-slate-900/98 backdrop-blur-lg border-t border-border/40 z-50">
      <div className="max-w-md mx-auto px-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        <div className="grid grid-cols-5 gap-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="flex flex-col items-center justify-center py-2 min-h-[56px] active:bg-muted/50 transition-colors rounded-lg"
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
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
                <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
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