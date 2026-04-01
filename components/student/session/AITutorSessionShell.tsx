'use client';

/**
 * AITutorSessionShell -- v2
 *
 * Thin shell that wraps AITutorChatPanel.
 * Switches to SessionCompletionScreen when onSessionComplete fires.
 *
 * Used by /session/[topicId]?sid=...&cid=... (AI tutor path only).
 * The V1 MCQ path still uses SessionContainer directly.
 */

import React, { useState } from 'react';
import { AITutorChatPanel } from './AITutorChatPanel';
import SessionCompletionScreen from './SessionCompletionScreen';

interface AITutorSessionShellProps {
  sessionId: string;
  conceptId: string;
  topicId: string;
  conceptName: string;
  subjectName: string;
  isAITutorEnabled: boolean;
}

type SessionSummary = {
  tag: string;
  stage: string;
  turnNumber: number;
  hintsUsed: number;
};

export default function AITutorSessionShell({
  sessionId,
  conceptId: _conceptId,
  topicId: _topicId,
  conceptName,
  subjectName,
  isAITutorEnabled,
}: AITutorSessionShellProps) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  if (summary) {
    return (
      <SessionCompletionScreen
        sessionId={sessionId}
        topicName={conceptName}
        hintsUsed={summary.hintsUsed}
        sessionSummary={summary}
      />
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <AITutorChatPanel
        sessionId={sessionId}
        conceptName={conceptName}
        subjectName={subjectName}
        initialStage="HOOK"
        isAITutorEnabled={isAITutorEnabled}
        onSessionComplete={(s) => setSummary(s)}
      />
    </div>
  );
}
