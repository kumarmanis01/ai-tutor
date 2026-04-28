'use client';

/**
 * FILE OBJECTIVE:
 * - Render the parent-approval celebration transition screen with lightweight CSS-based
 *   confetti and a timed completion callback. S0.3 explore mode.
 *   No animation libraries -- pure CSS keyframes per CLAUDE.md rules.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/explore/ApprovalTransition.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-28T00:00:00Z | staff-engineer | created for S0.3 explore mode
 */

import { useEffect } from 'react';

interface Props {
  onComplete: () => void;
}

export default function ApprovalTransition({ onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(onComplete, 1500);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
          position: fixed;
          top: -10px;
          width: 10px;
          height: 10px;
          border-radius: 2px;
          animation: confetti-fall 2s ease-in forwards;
          z-index: 9999;
        }
      `}</style>

      {/* Confetti pieces */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.8}s`,
            animationDuration: `${1.5 + Math.random() * 0.8}s`,
            backgroundColor: ['#534AB7', '#1D9E75', '#BA7517', '#E24B4A', '#FBBF24'][i % 5],
          }}
          aria-hidden
        />
      ))}

      {/* Celebration card */}
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-white/90 dark:bg-slate-950/90 px-6">
        <div className="text-center max-w-xs">
          <div className="text-6xl mb-4" aria-hidden>
            🎉
          </div>
          <h1 className="text-2xl font-bold text-[#1D9E75] mb-2">Mom Approved!</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Get ready for unlimited learning!
          </p>
          <div className="mt-5 flex justify-center">
            <div className="h-1.5 w-24 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-[#1D9E75] rounded-full"
                style={{ animation: 'grow-bar 1.5s linear forwards' }}
              />
            </div>
          </div>
          <style>{`
            @keyframes grow-bar { from { width: 0% } to { width: 100% } }
          `}</style>
        </div>
      </div>
    </>
  );
}
