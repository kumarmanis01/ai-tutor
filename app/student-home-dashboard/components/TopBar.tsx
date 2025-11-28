'use client';

import React from 'react';


interface TopBarProps {
  studentName: string;
}

const TopBar: React.FC<TopBarProps> = ({ studentName }) => {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
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

        {/* Right: Profile Icon */}
        <button 
          className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
          aria-label="Profile Menu"
        >
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default TopBar;