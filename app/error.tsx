/**
 * FILE OBJECTIVE:
 * - Root-level error boundary for the Next.js App Router.
 * - Catches unhandled errors that bubble up from any route segment.
 * - Renders a generic, safe error message (never exposes raw error details).
 *
 * LINKED UNIT TEST: none (client error boundary -- render tested in E2E)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | claude | added root error boundary, scrubbed raw error.message from UI
 */
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error: _error, reset }: ErrorProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <h1 className="text-7xl font-bold text-danger opacity-20">Error</h1>
          </div>
        </div>

        <h2 className="text-2xl font-medium text-foreground mb-2">Something went wrong!</h2>
        <p className="text-foreground/70 mb-8">
          {"An unexpected error occurred. Please try again."}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-hover transition-colors duration-200"
          >
            Try again
          </button>

          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] border border-border bg-background text-foreground px-6 py-3 rounded-lg font-medium hover:bg-surface-sunk transition-colors duration-200"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
