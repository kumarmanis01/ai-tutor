"use client";

import React from 'react';
import { TestsFilters } from './TestsFilters';
import { TestsRecommended } from './TestsRecommended';
import { TestsUpcoming } from './TestsUpcoming';
import { TestsResults } from './TestsResults';
import TestHome from '@/components/Test/TestHome';

export function TestsHome({ subject, grade, board }: { subject: string; grade?: string; board?: string }) {
  return (
    <div className="space-y-6">
      <TestsFilters />
      <TestsRecommended />
      <TestsUpcoming />
      <TestsResults />
      {/* Fallback to existing TestHome while we extract remaining UI */}
      <TestHome subject={subject} grade={grade} board={board} />
    </div>
  );
}
