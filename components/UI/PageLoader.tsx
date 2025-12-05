'use client';

import React from 'react';
import LoadingSpinner from './LoadingSpinner';

export default function PageLoader({ label }: { label?: string | null }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner size={56} label={label ?? 'Loading…'} />
    </div>
  );
}
