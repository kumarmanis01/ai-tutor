'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error: _error, reset }: ErrorProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <h1 className="text-7xl font-bold text-danger opacity-20 mb-6">Error</h1>
        <h2 className="text-2xl font-medium text-onBackground mb-2">Admin panel error</h2>
        <p className="text-onBackground/70 mb-8">
          {"An unexpected error occurred. Please try again or reload."}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors duration-200"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] border border-border bg-background text-foreground px-6 py-3 rounded-lg font-medium hover:bg-surface transition-colors duration-200"
          >
            Back to Admin
          </button>
        </div>
      </div>
    </div>
  );
}
