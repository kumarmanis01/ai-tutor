'use client';

/**
 * AITutorSessionShell -- v2
 *
 * Thin shell that wraps AITutorChatPanel.
 * Switches to SessionCompletionScreen when onSessionComplete fires.
 *
 * For whiteboard subjects (geometry / algebra / chemistry / physics / maths),
 * renders a side-by-side layout: chat (left) + WhiteboardPanel (right) on md+.
 * On narrow screens the whiteboard is stacked below the chat (F-STU-014 AC-01).
 *
 * Used by /session/[topicId]?sid=...&cid=... (AI tutor path only).
 * The V1 MCQ path still uses SessionContainer directly.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | F-STU-014: whiteboard integration for relevant subjects
 */

import React, { useState } from 'react';
import { AITutorChatPanel } from './AITutorChatPanel';
import SessionCompletionScreen from './SessionCompletionScreen';
import WhiteboardPanel from './WhiteboardPanel';

// AC-01: subjects that auto-activate the whiteboard.
const WHITEBOARD_SUBJECTS = new Set([
  'mathematics',
  'maths',
  'math',
  'physics',
  'chemistry',
  'geometry',
  'algebra',
]);

function needsWhiteboard(subjectName: string): boolean {
  return WHITEBOARD_SUBJECTS.has(subjectName.toLowerCase().trim());
}

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
  // AC-02: AI step lines for the whiteboard, updated on each completed AI message.
  const [aiSteps, setAiSteps] = useState<string[]>([]);
  // Optional structured visual hint (JSON or structured text) from the LLM
  const [visualHint, setVisualHint] = useState<string | null>(null);

  const showWhiteboard = needsWhiteboard(subjectName);

  function handleAiMessage(content: string) {
    // Split AI message into non-empty lines for step-by-step reveal.
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) setAiSteps(lines);
  }

  function handleVisualHint(viz: string) {
    setVisualHint(viz);
  }

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

  // ── Layout ───────────────────────────────────────────────────────────────────
  // Mobile: single column, whiteboard below chat.
  // md+: side-by-side (chat 60%, whiteboard 40%) when whiteboard is active.

  if (showWhiteboard) {
    return (
      <div className="h-dvh flex flex-col md:flex-row overflow-hidden">
        {/* Chat column */}
        <div className="flex flex-col flex-1 min-h-0 md:w-3/5">
          <AITutorChatPanel
            sessionId={sessionId}
            conceptName={conceptName}
            subjectName={subjectName}
            initialStage="HOOK"
            isAITutorEnabled={isAITutorEnabled}
            onSessionComplete={(s) => setSummary(s)}
            onAiMessage={handleAiMessage}
            onVisualHint={handleVisualHint}
          />
        </div>

        {/* Whiteboard column */}
        <div className="flex flex-col md:w-2/5 min-h-[300px] md:min-h-0 border-t md:border-t-0 md:border-l border-gray-200 dark:border-slate-700 p-2">
          <WhiteboardPanel
            sessionId={sessionId}
            conceptName={conceptName}
            aiSteps={aiSteps}
            visualHint={visualHint}
          />
        </div>
      </div>
    );
  }

  // No whiteboard: original full-width layout.
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
