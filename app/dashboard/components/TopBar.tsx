"use client";
/**
 * FILE OBJECTIVE:
 * - Compact mobile-first header with logo, greeting, and essential actions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/TopBar.spec.ts
 *
 * EDIT LOG:
 * - 2025-01-22 | copilot | optimized for mobile-first with compact design
 */
import React from "react";
import { useTheme } from '@/components/UI/ThemeProvider';

interface TopBarProps {
  studentName: string;
}

// Helper to get greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Morning', emoji: '🌅', hi: 'सुप्रभात' };
  if (hour < 17) return { text: 'Afternoon', emoji: '☀️', hi: 'नमस्ते' };
  if (hour < 21) return { text: 'Evening', emoji: '🌆', hi: 'शुभ संध्या' };
  return { text: 'Night', emoji: '🌙', hi: 'शुभ रात्रि' };
};

const TopBar: React.FC<TopBarProps> = ({ studentName }) => {
  const { theme, toggle } = useTheme();
  const greeting = getGreeting();
  const firstName = studentName.split(' ')[0];
  
  return (
    <header className="sticky top-0 z-50 bg-card/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-border/30">
      <div className="max-w-4xl mx-auto px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-xs">S</span>
            </div>
          </div>

          {/* Center: Compact Greeting */}
          <div className="flex-1 min-w-0 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-base">{greeting.emoji}</span>
              <span className="font-semibold text-foreground truncate text-sm">
                {firstName}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="w-8 h-8 rounded-full bg-muted/60 dark:bg-slate-800/80 flex items-center justify-center active:scale-95 transition-transform text-foreground"
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            
            {/* Notification bell */}
            <button
              className="relative w-8 h-8 rounded-full bg-muted/60 dark:bg-slate-800/80 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Notifications"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;