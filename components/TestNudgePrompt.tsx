/**
 * FILE OBJECTIVE:
 * - Display test nudges/prompts to users based on their learning progress.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/TestNudgePrompt.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created test nudge prompt component
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { logger } from '@/lib/logger';

const CLASS_NAME = 'TestNudgePrompt';

interface TestNudge {
  type: string;
  title: string;
  message: string;
  topicId?: string;
  topicName?: string;
  subjectName?: string;
  priority: 'high' | 'medium' | 'low';
  actionUrl: string;
  dismissable: boolean;
  metadata?: Record<string, unknown>;
}

interface TestNudgePromptProps {
  /** Position on screen */
  position?: 'top' | 'bottom' | 'floating';
  /** Maximum number of nudges to show */
  maxNudges?: number;
  /** Auto-hide after X seconds (0 = don't auto-hide) */
  autoHideSeconds?: number;
  /** Class names for custom styling */
  className?: string;
}

/**
 * Color scheme based on nudge priority
 */
const priorityStyles = {
  high: {
    bg: 'bg-gradient-to-r from-purple-500 to-indigo-600',
    border: 'border-purple-400',
    icon: '🎯',
  },
  medium: {
    bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    border: 'border-blue-400',
    icon: '💡',
  },
  low: {
    bg: 'bg-gradient-to-r from-gray-500 to-slate-600',
    border: 'border-gray-400',
    icon: '📚',
  },
};

/**
 * TestNudgePrompt component - displays personalized test prompts to users
 */
export default function TestNudgePrompt({
  position = 'floating',
  maxNudges = 1,
  autoHideSeconds = 0,
  className = '',
}: TestNudgePromptProps): JSX.Element | null {
  const { status } = useSession();
  const [nudges, setNudges] = useState<TestNudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(true);

  /**
   * Fetch nudges from API
   */
  const fetchNudges = useCallback(async () => {
    if (status !== 'authenticated') return;

    try {
      const res = await fetch('/api/nudges/test-prompt');
      if (res.ok) {
        const data = await res.json();
        setNudges(data.nudges || []);
      }
    } catch (error) {
      logger.error('Failed to fetch nudges', {
        className: CLASS_NAME,
        methodName: 'fetchNudges',
        error: String(error),
      });
    } finally {
      setLoading(false);
    }
  }, [status]);

  /**
   * Handle nudge dismissal
   */
  const handleDismiss = async (nudgeType: string) => {
    setDismissed((prev) => new Set([...prev, nudgeType]));

    try {
      await fetch('/api/nudges/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nudgeType, action: 'dismiss' }),
      });
    } catch (error) {
      logger.error('Failed to dismiss nudge', {
        className: CLASS_NAME,
        methodName: 'handleDismiss',
        error: String(error),
      });
    }
  };

  /**
   * Handle nudge click
   */
  const handleClick = async (nudge: TestNudge) => {
    try {
      await fetch('/api/nudges/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nudgeType: nudge.type, action: 'click' }),
      });
    } catch {
      // Don't block navigation on error
    }
  };

  // Fetch nudges on mount
  useEffect(() => {
    fetchNudges();
  }, [fetchNudges]);

  // Auto-hide after specified seconds
  useEffect(() => {
    if (autoHideSeconds > 0) {
      const timer = setTimeout(() => setVisible(false), autoHideSeconds * 1000);
      return () => clearTimeout(timer);
    }
  }, [autoHideSeconds]);

  // Don't render if no session, loading, no nudges, or hidden
  if (status !== 'authenticated' || loading || !visible) return null;

  // Filter dismissed nudges and limit
  const visibleNudges = nudges
    .filter((n) => !dismissed.has(n.type))
    .slice(0, maxNudges);

  if (visibleNudges.length === 0) return null;

  // Position classes
  const positionClasses = {
    top: 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-lg px-4',
    bottom: 'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-lg px-4',
    floating: 'fixed bottom-20 right-4 z-50 w-80',
  };

  return (
    <div className={`${positionClasses[position]} ${className}`}>
      {visibleNudges.map((nudge, index) => {
        const styles = priorityStyles[nudge.priority];

        return (
          <div
            key={`${nudge.type}-${index}`}
            className={`
              ${styles.bg} ${styles.border}
              rounded-xl shadow-2xl overflow-hidden
              transform transition-all duration-300 ease-out
              animate-slide-up
              ${index > 0 ? 'mt-3' : ''}
            `}
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{styles.icon}</span>
                <h3 className="text-white font-bold text-sm">{nudge.title}</h3>
              </div>
              {nudge.dismissable && (
                <button
                  onClick={() => handleDismiss(nudge.type)}
                  className="text-white/70 hover:text-white transition-colors p-1"
                  aria-label="Dismiss"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Body */}
            <div className="px-4 pb-2">
              <p className="text-white/90 text-sm leading-relaxed">{nudge.message}</p>
              {nudge.subjectName && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-white/20 rounded-full text-white/80 text-xs">
                  {String(nudge.subjectName)}
                </span>
              )}
            </div>

            {/* Action Button */}
            <div className="px-4 pb-4">
              <Link
                href={nudge.actionUrl}
                onClick={() => handleClick(nudge)}
                className="
                  block w-full py-2.5 px-4
                  bg-white text-gray-900
                  font-semibold text-sm text-center
                  rounded-lg
                  hover:bg-gray-100
                  transition-colors
                  shadow-md
                "
              >
                Try It Out →
              </Link>
            </div>

            {/* Progress indicator for topic */}
            {nudge.metadata?.lessonsCompleted && (
              <div className="px-4 pb-3">
                <div className="flex items-center text-white/70 text-xs">
                  <span>📖 {String(nudge.metadata.lessonsCompleted)} lessons completed</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Animation styles */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

/**
 * Compact version for embedding in pages
 */
export function TestNudgeBanner({ className = '' }: { className?: string }): JSX.Element | null {
  return <TestNudgePrompt position="top" maxNudges={1} className={className} />;
}

/**
 * Floating notification version (default)
 */
export function TestNudgeFloating({ className = '' }: { className?: string }): JSX.Element | null {
  return <TestNudgePrompt position="floating" maxNudges={2} className={className} />;
}
