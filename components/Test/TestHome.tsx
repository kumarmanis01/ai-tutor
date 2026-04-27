"use client";

import React from 'react';
import QuickPractice from './QuickPractice';
import ChapterTests from './ChapterTests';
import TestHistory from './TestHistory';
import WeeklyChallenge from './WeeklyChallenge';

/**
 * TestHome
 *
 * Encapsulates the complete test journey UI for embedding in the dashboard
 * Tests tab and for use on /tests. Keeps StudentHomeDashboard lean.
 */
export default function TestHome(props: { subject?: string; grade?: string; board?: string }) {
  const { subject, grade, board } = props;

  return (
    <div className="space-y-6">
      <QuickPractice subject={subject} questionCount={8} />
      <ChapterTests subject={subject} grade={grade} board={board} />
      <TestHistory />
      <WeeklyChallenge />
    </div>
  );
}
