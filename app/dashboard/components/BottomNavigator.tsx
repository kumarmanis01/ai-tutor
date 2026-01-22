'use client';

import React from 'react';

interface BottomNavigationProps {
  activeTab: 'home' | 'tests' | 'notes' | 'profile';
  onTabChange: (tab: 'home' | 'tests' | 'notes' | 'profile') => void;
}

interface NavTab {
  id: 'home' | 'tests' | 'notes' | 'profile';
  label: string;
  labelHi: string;
  icon: (active: boolean) => React.ReactNode;
  color: string;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs: NavTab[] = [
    {
      id: 'home',
      label: 'Home',
      labelHi: 'होम',
      color: 'from-blue-500 to-cyan-500',
      icon: (active) => (
        <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'tests',
      label: 'Tests',
      labelHi: 'परीक्षा',
      color: 'from-purple-500 to-pink-500',
      icon: (active) => (
        <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'notes',
      label: 'Notes',
      labelHi: 'नोट्स',
      color: 'from-emerald-500 to-teal-500',
      icon: (active) => (
        <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      labelHi: 'प्रोफाइल',
      color: 'from-orange-500 to-amber-500',
      icon: (active) => (
        <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-border/50 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.3)] z-50">
      <div className="max-w-4xl mx-auto px-2 safe-area-pb">
        <div className="grid grid-cols-4 gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-col items-center justify-center py-2.5 transition-all duration-300 rounded-xl mx-1 my-1.5 ${
                  isActive
                    ? 'text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {/* Active background gradient */}
                {isActive && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${tab.color} rounded-xl shadow-lg`} />
                )}
                
                {/* Icon container */}
                <div className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                  {tab.icon(isActive)}
                </div>
                
                {/* Label with bilingual support */}
                <div className="relative z-10 mt-1">
                  <span className={`text-[10px] font-medium block leading-tight ${isActive ? 'text-white' : ''}`}>
                    {tab.label}
                  </span>
                  <span className={`text-[8px] block leading-tight ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {tab.labelHi}
                  </span>
                </div>

                {/* Active indicator dot */}
                {isActive && (
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Safe area padding for iOS */}
      <style jsx>{`
        .safe-area-pb {
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
      `}</style>
    </nav>
  );
};

export default BottomNavigation;