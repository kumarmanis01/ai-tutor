'use client';

import React from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
          <div className="text-center max-w-md">
            <h1 className="text-7xl font-bold text-red-500 opacity-20 mb-6">Error</h1>
            <h2 className="text-2xl font-medium text-gray-900 mb-2">Something went wrong!</h2>
            <p className="text-gray-600 mb-8">
              {error.message || 'An unexpected error occurred'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
              >
                Try again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="inline-flex items-center justify-center gap-2 border border-gray-300 bg-white text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
