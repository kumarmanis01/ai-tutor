"use client";

import React from "react";
import { useTheme } from '@/components/UI/ThemeProvider';

interface TopBarProps {
  studentName: string;
}

// Helper to get greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good Morning', emoji: '🌅' };
  if (hour < 17) return { text: 'Good Afternoon', emoji: '☀️' };
  if (hour < 21) return { text: 'Good Evening', emoji: '🌆' };
  return { text: 'Good Night', emoji: '🌙' };
};

// Sun icon for light mode
const SunIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

// Moon icon for dark mode
const MoonIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// Bell icon for notifications
const BellIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const TopBar: React.FC<TopBarProps> = ({ studentName }) => {
  const { theme, toggle } = useTheme();
  const greeting = getGreeting();
  
  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-card via-card to-card/95 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-b border-border/50 shadow-sm backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo with gradient */}
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-xl blur-sm opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-foreground">Spinzy</span>
              <span className="text-primary font-semibold ml-1">Academy</span>
            </div>
          </div>

          {/* Center: Personalized Greeting */}
          <div className="flex-1 text-center px-2">
            <div className="inline-flex flex-col items-center">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {greeting.emoji} {greeting.text}
              </span>
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate max-w-[200px] sm:max-w-none">
                Hi, {studentName}! 
                <span className="inline-block ml-1 animate-wave">👋</span>
              </h1>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button
              className="relative w-9 h-9 rounded-full bg-muted/50 dark:bg-slate-800 flex items-center justify-center hover:bg-muted transition-all duration-200 hover:scale-105"
              aria-label="Notifications"
            >
              <BellIcon />
              {/* Notification dot */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-full bg-muted/50 dark:bg-slate-800 flex items-center justify-center hover:bg-muted transition-all duration-200 hover:scale-105 text-foreground"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Animated wave keyframes (inline style for simplicity) */}
      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(20deg); }
          75% { transform: rotate(-10deg); }
        }
        .animate-wave {
          animation: wave 1.5s ease-in-out infinite;
          display: inline-block;
          transform-origin: 70% 70%;
        }
      `}</style>
    </header>
  );
};

export default TopBar;