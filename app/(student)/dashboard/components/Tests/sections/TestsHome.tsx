"use client";

import React from 'react';
import { TestsRecommended } from './TestsRecommended';
import { TestsUpcoming } from './TestsUpcoming';
import { TestsResults } from './TestsResults';
import { TestsBySubject } from './TestsBySubject';
import { TestsCTAs } from './TestsCTAs';

export function TestsHome(
  { subject: _subject, grade: _grade, board: _board }: { subject: string; grade?: string; board?: string }
) {
  void _subject; void _grade; void _board;
  return (
    <div className="space-y-6">
      <TestsCTAs />
      <TestsRecommended />
      <TestsBySubject />
      <TestsUpcoming />
      <TestsResults />
    </div>
  );
}
