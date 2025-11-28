"use client";

import React from "react";
import { useTheme } from '@/components/UI/ThemeProvider';


interface TopBarProps {
  studentName: string;
}

const TopBar: React.FC<TopBarProps> = ({ studentName }) => {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="font-semibold text-sm text-foreground hidden sm:inline">AI Tutor</span>
          </div>
        </div>

        {/* Center: Greeting */}
        <div className="flex-1 text-center">
          <h1 className="text-base sm:text-lg font-semibold text-foreground">
            Hi, {studentName}! 👋
          </h1>
        </div>

        {/* Right: Theme toggle + Profile Icon */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M21.64 13.65A9 9 0 1110.35 2.36 7 7 0 0021.64 13.65z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 4.5a1 1 0 011 1V7a1 1 0 11-2 0V5.5a1 1 0 011-1zM12 17a1 1 0 011 1v1.5a1 1 0 11-2 0V18a1 1 0 011-1zM4.5 12a1 1 0 011-1H7a1 1 0 110 2H5.5a1 1 0 01-1-1zM17 12a1 1 0 011-1h1.5a1 1 0 110 2H18a1 1 0 01-1-1zM6.22 6.22a1 1 0 011.41 0l1.06 1.06a1 1 0 11-1.41 1.41L6.22 7.63a1 1 0 010-1.41zM16.31 16.31a1 1 0 011.41 0l1.06 1.06a1 1 0 11-1.41 1.41l-1.06-1.06a1 1 0 010-1.41zM6.22 17.78a1 1 0 010-1.41l1.06-1.06a1 1 0 111.41 1.41L7.63 17.78a1 1 0 01-1.41 0zM16.31 7.69a1 1 0 010-1.41l1.06-1.06a1 1 0 111.41 1.41L17.72 7.69a1 1 0 01-1.41 0z" />
              </svg>
            )}
          </button>

          <button
            className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
            aria-label="Profile Menu"
          >
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;