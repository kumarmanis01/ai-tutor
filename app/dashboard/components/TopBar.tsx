"use client";
/**
 * FILE OBJECTIVE:
 * - Responsive header with logo, greeting, and essential actions.
 *   Compact on mobile, expanded on desktop.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/TopBar.spec.ts
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | updated for new 5-tab IA (added doubts)
 * - 2025-01-23 | copilot | made responsive for desktop with larger spacing
 * - 2025-01-22 | copilot | optimized for mobile-first with compact design
 */
import React from "react";
import { useTheme } from '@/components/UI/ThemeProvider';
import type { TabId } from './BottomNavigator';

interface TopBarProps {
  studentName: string;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}

// Helper to get greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Morning', emoji: '🌅', hi: 'सुप्रभात' };
  if (hour < 17) return { text: 'Afternoon', emoji: '☀️', hi: 'नमस्ते' };
  if (hour < 21) return { text: 'Evening', emoji: '🌆', hi: 'शुभ संध्या' };
  return { text: 'Night', emoji: '🌙', hi: 'शुभ रात्रि' };
};

const TopBar: React.FC<TopBarProps> = ({ studentName, activeTab = 'home', onTabChange }) => {
  const { theme, toggle } = useTheme();
  const greeting = getGreeting();
  const firstName = studentName.split(' ')[0];

  const tabs: { key: TabId; label: string }[] = [
    { key: 'home', label: 'Home' },
    { key: 'notes', label: 'Notes' },
    { key: 'tests', label: 'Practice' },
    { key: 'doubts', label: 'Doubts' },
    { key: 'profile', label: 'Profile' },
  ];
  
  return (
    <header className="sticky top-0 z-50 bg-card/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-border/30">
      <div className="max-w-lg lg:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-2.5 lg:py-3">
        <div className="flex items-center justify-between gap-2 lg:gap-4">
          {/* Left: Logo */}
          <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
            <div className="w-9 h-9 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-xs lg:text-sm">S</span>
            </div>
            {/* Brand name - visible on desktop */}
            <span className="hidden lg:inline text-lg font-bold text-foreground">Spinzy</span>
          </div>

          {/* Center: Greeting - expanded on desktop */}
          <div className="flex-1 min-w-0 text-center lg:text-left lg:flex-none">
            <div className="flex items-center justify-center lg:justify-start gap-1.5 lg:gap-2">
              <span className="text-base lg:text-xl">{greeting.emoji}</span>
              <span className="font-semibold text-foreground truncate text-sm lg:text-base">
                <span className="hidden lg:inline">Good {greeting.text}, </span>
                {firstName}
              </span>
            </div>
            {/* Hindi greeting on desktop */}
            <p className="hidden lg:block text-xs text-muted-foreground mt-0.5">{greeting.hi}!</p>
          </div>

          {/* Right: Actions - larger touch targets on desktop */}
          <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-muted/60 dark:bg-slate-800/80 flex items-center justify-center active:scale-95 transition-transform text-foreground hover:bg-muted"
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4 lg:w-5 lg:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg className="w-4 h-4 lg:w-5 lg:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            
            {/* Notification bell */}
            <button
              className="relative w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-muted/60 dark:bg-slate-800/80 flex items-center justify-center active:scale-95 transition-transform hover:bg-muted"
              aria-label="Notifications"
            >
              <svg className="w-4 h-4 lg:w-5 lg:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* Desktop-only: Navigation tabs */}
            <nav className="hidden lg:flex items-center gap-1 ml-4 bg-muted/40 dark:bg-slate-800/60 rounded-full p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => onTabChange?.(tab.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;