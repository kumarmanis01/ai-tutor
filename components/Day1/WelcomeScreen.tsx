/**
 * FILE OBJECTIVE:
 * - Day-1 Welcome Screen component.
 * - First 10 seconds of user experience.
 * - Goal: Reduce fear, remove pressure, set expectations.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Day1/WelcomeScreen.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | copilot | created welcome screen
 */

'use client';

import React from 'react';
import {
  WelcomeScreenProps,
  WELCOME_COPY_HI,
  WELCOME_COPY_EN,
} from './types';

/**
 * Day-1 Welcome Screen
 * 
 * UX Rules (FROZEN):
 * - Must feel safe, not serious
 * - Mention time limit (10–15 min)
 * - Explicitly say mistakes are okay
 * - Exactly one CTA
 * 
 * Tone: Friendly, simple, pressure-free
 * Target: Tier-3/4 K-12 student
 */
export function WelcomeScreen({
  studentName,
  onStart,
  language,
}: WelcomeScreenProps): React.ReactElement {
  const copy = language === 'hi' ? WELCOME_COPY_HI : WELCOME_COPY_EN;

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-50 to-white"
      role="main"
      aria-label="Welcome screen"
    >
      {/* Greeting - Large, friendly */}
      <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8 text-center">
        {copy.greeting(studentName)}
      </h1>

      {/* Body message - Calm, reassuring */}
      <div className="max-w-md mx-auto mb-12">
        <p className="text-lg md:text-xl text-gray-600 text-center whitespace-pre-line leading-relaxed">
          {copy.body}
        </p>
      </div>

      {/* Single CTA - The only action */}
      <button
        onClick={onStart}
        className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white text-xl font-semibold rounded-full shadow-lg transform transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
        aria-label={copy.cta}
      >
        {copy.cta}
      </button>

      {/* Safety indicator - Visual reassurance */}
      <div className="mt-12 flex items-center text-gray-400">
        <svg 
          className="w-5 h-5 mr-2" 
          fill="currentColor" 
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path 
            fillRule="evenodd" 
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
            clipRule="evenodd" 
          />
        </svg>
        <span className="text-sm">
          {language === 'hi' ? 'Koi pressure nahi' : 'No pressure'}
        </span>
      </div>
    </div>
  );
}

export default WelcomeScreen;
