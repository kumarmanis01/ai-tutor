'/**
 * FILE OBJECTIVE:
 * - Render the AI tutor chat panel including stage strip, message history, input bar, and hint controls.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/session/AITutorChatPanel.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | fix: add object-cover to Vidya avatar image to prevent stretching in chat messages
 * - 2026-04-13 | copilot | feat(F-STU-011): add session-level style selector (persist & immediate re-explain)
 * - 2026-04-14 | copilot | fix: add onVisualHint to props destructuring (was referenced but not bound,
 *   causing ReferenceError / Jest worker crash in AITutorChatPanel.spec.tsx)
 * - 2026-04-22 | copilot | chore(theme): PoC replace high-impact hard-coded hex values with CSS variable tokens
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { stripTag } from '@/lib/ai/tutor/tagParser';
import VisualHintRenderer from './VisualHintRenderer';
import MisconceptionCard from './MisconceptionCard';
import { logger } from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────────────────────

type MessageRole = 'student' | 'ai';

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
}

// Items rendered in the chat list -- either a message or a stage-transition divider
type MessageItem =
  | { kind: 'msg'; msg: ChatMessage }
  | { kind: 'divider'; id: string; label: string };

export interface AITutorChatPanelProps {
  sessionId: string;
  conceptName: string;
  subjectName: string;
  initialStage: string;
  isAITutorEnabled: boolean;
  onSessionComplete: (summary: { tag: string; stage: string; turnNumber: number; hintsUsed: number }) => void;
  /** Called with the full text each time an AI message stream completes (F-STU-014 whiteboard). */
  onAiMessage?: (content: string) => void;
  /** Called when the server returns a structured visualHint (diagram) for the whiteboard. */
  onVisualHint?: (visualHint: string) => void;
}

type TutorTurnCompleteEvent = {
  tag: string;
  stage: string;
  hintsRemaining: number;
  /** Optional: number of hints used during the call (pre-call hintsUsed) */
  hintsUsedDuringTurn?: number;
  turnNumber: number;
  sessionComplete: boolean;
  /** Optional visual hint brief (diagram) returned by the LLM */
  visualHint?: string | null;
};

type TutorErrorEvent = {
  code: string;
  message: string;
  retryable: boolean;
};

type SseEventType = 'token' | 'complete' | 'error';

interface ParsedSseEvent<T = unknown> {
  event: SseEventType;
  data: T;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STAGE_ORDER = [
  'HOOK',
  'PREREQ_BRIDGE',
  'CORE_EXPLANATION',
  'WORKED_EXAMPLE',
  'GUIDED_PRACTICE',
  'INDEPENDENT_PRACTICE',
  'CONSOLIDATION',
] as const;

type StageKey = (typeof STAGE_ORDER)[number];

const STAGE_LABELS: Record<string, string> = {
  HOOK: 'Hook',
  PREREQ_BRIDGE: 'Prereq Bridge',
  CORE_EXPLANATION: 'Core Explanation',
  WORKED_EXAMPLE: 'Worked Example',
  GUIDED_PRACTICE: 'Guided Practice',
  INDEPENDENT_PRACTICE: 'Indep. Practice',
  CONSOLIDATION: 'Consolidation',
};

// Stages where the hint bar is NOT shown
const NO_HINT_STAGES = new Set<string>([
  'HOOK',
  'PREREQ_BRIDGE',
  'CORE_EXPLANATION',
  'WORKED_EXAMPLE',
]);

// AC-04 (F-STU-011 MUST): stages where the re-explain style selector is shown
const RESTYLE_STAGES = new Set<string>([
  'HOOK',
  'CORE_EXPLANATION',
  'WORKED_EXAMPLE',
  'GUIDED_PRACTICE',
  'INDEPENDENT_PRACTICE',
]);

const INACTIVITY_MS = 90_000;
const MAX_RECONNECT = 3;
const TEXTAREA_LINE_HEIGHT = 22; // px -- matches text-sm + line-height
const TEXTAREA_MAX_LINES = 4;

// ── CSS (injected via <style>) ─────────────────────────────────────────────────

const PANEL_STYLE = `
@keyframes v2-msg-appear {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.v2-msg-appear {
  animation: v2-msg-appear 0.15s ease-out forwards;
}
@keyframes v2-dot-bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40%            { transform: translateY(-5px); }
}
.v2-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: v2-dot-bounce 1.1s ease-in-out infinite;
}
/* per-dot animation delays moved out of inline styles to satisfy lint */
.v2-dot-delay-0 { animation-delay: 0ms; }
.v2-dot-delay-200 { animation-delay: 200ms; }
.v2-dot-delay-400 { animation-delay: 400ms; }
@keyframes v2-cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
.v2-cursor {
  animation: v2-cursor-blink 0.5s step-end infinite;
  margin-left: 1px;
  user-select: none;
  font-weight: 300;
}
@keyframes v2-divider-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.v2-divider {
  animation: v2-divider-fade 0.4s ease-out 0.1s both;
}
@keyframes v2-inactivity-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
}
.v2-inactivity {
  animation: v2-inactivity-pulse 2s ease-in-out infinite;
}
/* Hide scrollbar on stage strip */
.v2-strip::-webkit-scrollbar { display: none; }
.v2-strip { scrollbar-width: none; -ms-overflow-style: none; }
/* safe-area aware input bar padding (avoid inline style) */
.input-bar-safe { padding-bottom: max(8px, env(safe-area-inset-bottom)); }
`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

function getStageIndex(stage: string): number {
  return STAGE_ORDER.indexOf(stage as StageKey);
}

function parseSseChunk(raw: string): ParsedSseEvent[] {
  const events: ParsedSseEvent[] = [];
  for (const block of raw.split('\n\n')) {
    if (!block.trim()) continue;
    let event: SseEventType | null = null;
    let data: unknown = null;
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.replace('event:', '').trim() as SseEventType;
      } else if (line.startsWith('data:')) {
        const payload = line.replace('data:', '').trim();
        try {
          data = JSON.parse(payload);
        } catch {
          data = payload;
        }
      }
    }
    if (event) events.push({ event, data });
  }
  return events;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StageStrip({ currentStage }: { currentStage: string }) {
  const activeIdx = getStageIndex(currentStage);
  return (
    <div className="v2-strip flex gap-1.5 overflow-x-auto px-3 pb-2 pt-1">
        {STAGE_ORDER.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        const cls = done
          ? 'bg-[var(--color-background)] text-[var(--color-success)] dark:bg-[var(--color-success)]/15 dark:text-[var(--color-success)]'
          : active
          ? 'bg-[var(--color-primary)] text-[var(--color-surface)]'
          : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500';
        return (
          <span
            key={s}
            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
          >
            {i + 1}. {getStageLabel(s)}
          </span>
        );
      })}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="v2-msg-appear mb-3 flex items-start">
      <div className="max-w-[85%] rounded-[4px_12px_12px_12px] bg-gray-100 px-3 py-2.5 dark:bg-gray-800">
        <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
          <span className="v2-dot v2-dot-delay-0" aria-hidden />
          <span className="v2-dot v2-dot-delay-200" aria-hidden />
          <span className="v2-dot v2-dot-delay-400" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function AiMessageBubble({
  msg,
  showLabel,
}: {
  msg: ChatMessage;
  showLabel: boolean;
}) {
  const content = msg.content ?? '';
  let looksLikeJson = false;
  try {
    looksLikeJson = !!content.trim() && (content.trim().startsWith('{') || content.trim().startsWith('['));
  } catch {
    looksLikeJson = false;
  }

  const MIS_PREFIX = '__MISCONCEPTION__';
  const isMisconception = typeof content === 'string' && content.startsWith(MIS_PREFIX);
  let parsedMisconception: any = null;
  if (isMisconception) {
    try {
      parsedMisconception = JSON.parse(content.slice(MIS_PREFIX.length))
    } catch {
      parsedMisconception = null
    }
  }

  return (
    <div className="v2-msg-appear mb-3 flex flex-col items-start">
      {showLabel && (
        <div className="mb-1 ml-1 flex items-center gap-1.5">
          <Image
            src="/logos/vidya/vidya-avatar-64.png"
            alt="Vidya"
            width={32}
            height={32}
            className="rounded-full flex-shrink-0 object-cover"
          />
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
            Teacher Vidya
          </span>
        </div>
      )}
      <div className="max-w-[85%] rounded-[4px_12px_12px_12px] bg-[var(--color-background)] px-3 py-2.5 text-sm leading-relaxed text-[var(--color-primary)] dark:bg-[var(--color-primary)]/20 dark:text-[var(--color-surface)] whitespace-pre-wrap break-words">
        {isMisconception && parsedMisconception ? (
          <MisconceptionCard artifact={parsedMisconception} />
        ) : looksLikeJson ? (
          <VisualHintRenderer hint={content} />
        ) : (
          (msg.content || '\u200B') /* zero-width space keeps bubble visible when empty */
        )}
        {msg.isStreaming && (
          <span className="v2-cursor text-[var(--color-primary)] dark:text-[var(--color-surface)]">|</span>
        )}
      </div>
    </div>
  );
}

function StudentMessageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="v2-msg-appear mb-3 flex justify-end">
      <div className="max-w-[75%] rounded-[12px_4px_12px_12px] bg-[var(--color-primary)] px-3 py-2.5 text-sm leading-relaxed text-[var(--color-surface)] whitespace-pre-wrap break-words">
        {msg.content}
      </div>
    </div>
  );
}

function StageDivider({ label }: { label: string }) {
  return (
    <div className="v2-divider my-4 flex items-center gap-2">
      <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
      <span className="whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
        -- Moving to {label} --
      </span>
      <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
    </div>
  );
}

type ReExplainChip = { label: string; sentinel: string; ariaLabel: string };

const RESTYLE_CHIPS: ReExplainChip[] = [
  { label: 'Simpler \u2193', sentinel: '__EXPLAIN_SIMPLER__', ariaLabel: 'Explain it more simply' },
  { label: 'Deeper \u2191', sentinel: '__EXPLAIN_HARDER__',  ariaLabel: 'Explain it in more depth' },
  { label: 'Real-life example',  sentinel: '__EXPLAIN_EXAMPLE__', ariaLabel: 'Give a real-life example' },
  { label: 'Diagram', sentinel: '__EXPLAIN_DIAGRAM__', ariaLabel: 'Show a diagram' },
];

const RESTYLE_DISPLAY: Record<string, string> = {
  __EXPLAIN_SIMPLER__: 'Explain it more simply',
  __EXPLAIN_HARDER__:  'Explain it in more depth',
  __EXPLAIN_EXAMPLE__: 'Give me a real-life example',
  __EXPLAIN_DIAGRAM__: 'Show a diagram or visual explanation',
};

function ReExplainBar({ onSelect, disabled }: { onSelect: (sentinel: string) => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-1.5 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
      <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500 mr-0.5">Re-explain:</span>
      {RESTYLE_CHIPS.map((chip) => (
        <button
          key={chip.sentinel}
          type="button"
          aria-label={chip.ariaLabel}
          disabled={disabled}
          onClick={() => onSelect(chip.sentinel)}
          className="shrink-0 min-h-[36px] rounded-full border border-[#534AB7]/30 dark:border-[#534AB7]/50 bg-[#EEEDFE] dark:bg-[#534AB7]/10 px-3 text-xs font-medium text-[#534AB7] dark:text-indigo-300 hover:bg-[#534AB7]/15 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export const AITutorChatPanel: React.FC<AITutorChatPanelProps> = ({
  sessionId,
  conceptName,
  subjectName: _subjectName,
  initialStage,
  isAITutorEnabled,
  onSessionComplete,
  onAiMessage,
  onVisualHint,
}) => {
  const [items, setItems] = useState<MessageItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isTyping, setIsTyping] = useState(false); // dots shown before first token
  const [hintsRemaining, setHintsRemaining] = useState(3);
  const [currentStage, setCurrentStage] = useState(initialStage);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [showInactivityPrompt, setShowInactivityPrompt] = useState(false);
  const [hintBanner, setHintBanner] = useState<{ tier: number; text: string } | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAiMsgIdRef = useRef<string | null>(null);
  // Accumulates streaming AI content so finalizeAiMessage can fire onAiMessage (F-STU-014).
  const lastAiContentRef = useRef('');
  const currentStageRef = useRef(initialStage);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasReceivedTokenRef = useRef(false); // first token received this turn?
  const onAiMessageRef = useRef(onAiMessage);
  onAiMessageRef.current = onAiMessage;
  const onVisualHintRef = useRef(onVisualHint);
  onVisualHintRef.current = onVisualHint;

  // ── Scroll to bottom ───────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [items, isTyping, scrollToBottom]);

  // ── Textarea auto-resize ───────────────────────────────────────────────────

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxHeight = TEXTAREA_LINE_HEIGHT * TEXTAREA_MAX_LINES + 16; // + padding
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, [inputValue]);

  // ── Inactivity timer ───────────────────────────────────────────────────────

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const scheduleInactivity = useCallback(() => {
    clearInactivityTimer();
    inactivityTimerRef.current = setTimeout(() => {
      setShowInactivityPrompt(true);
    }, INACTIVITY_MS);
  }, [clearInactivityTimer]);

  useEffect(() => {
    // Schedule inactivity prompt on mount so quiet sessions show the offer after 90s
    scheduleInactivity();
    return () => {
      clearInactivityTimer();
      if (hintBannerTimerRef.current) clearTimeout(hintBannerTimerRef.current);
    };
  }, [scheduleInactivity, clearInactivityTimer]);

  // Load persisted session-level explainStyle (if any) so selector shows current value
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
          const resp = await fetch(`/api/tutor/session/style?sessionId=${encodeURIComponent(sessionId)}`)
          if (!resp.ok) return
          const data = await resp.json()
          if (!mounted) return
          setSelectedStyle(data?.explainStyle ?? null)
        } catch (e) {
          logger.debug('AITutorChatPanel: failed to load session style', { sessionId, error: String(e) })
        }
    })()
    return () => { mounted = false }
  }, [sessionId])

  // ── Message helpers ────────────────────────────────────────────────────────

  const addStudentMessage = useCallback((content: string) => {
    const msg: ChatMessage = { id: makeId('s'), role: 'student', content };
    setItems((prev) => [...prev, { kind: 'msg', msg }]);
  }, []);

  const startAiMessage = useCallback(() => {
    const id = makeId('ai');
    lastAiMsgIdRef.current = id;
    lastAiContentRef.current = '';
    hasReceivedTokenRef.current = false;
    setIsTyping(true);
    const msg: ChatMessage = { id, role: 'ai', content: '', isStreaming: true };
    setItems((prev) => [...prev, { kind: 'msg', msg }]);
  }, []);

  const appendAiChunk = useCallback((chunk: string) => {
    const id = lastAiMsgIdRef.current;
    if (!id) return;
    if (!hasReceivedTokenRef.current) {
      hasReceivedTokenRef.current = true;
      setIsTyping(false); // first token → hide dots, show streaming bubble
    }
    lastAiContentRef.current += chunk;
    setItems((prev) =>
      prev.map((item) =>
        item.kind === 'msg' && item.msg.id === id
          ? { kind: 'msg', msg: { ...item.msg, content: item.msg.content + chunk } }
          : item,
      ),
    );
  }, []);

  const finalizeAiMessage = useCallback(() => {
    const id = lastAiMsgIdRef.current;
    if (!id) return;
    setIsTyping(false);
    setItems((prev) =>
      prev.map((item) =>
        item.kind === 'msg' && item.msg.id === id
          ? { kind: 'msg', msg: { ...item.msg, isStreaming: false } }
          : item,
      ),
    );
    // Notify whiteboard panel with completed AI message content (F-STU-014).
    const content = lastAiContentRef.current;
    if (content) onAiMessageRef.current?.(content);
    lastAiMsgIdRef.current = null;
    lastAiContentRef.current = '';
  }, []);

  // ── Stage transition ───────────────────────────────────────────────────────

  const insertStageDivider = useCallback((newStage: string) => {
    setItems((prev) => [
      ...prev,
      { kind: 'divider', id: makeId('div'), label: getStageLabel(newStage) },
    ]);
  }, []);

  // ── Complete / error event handlers ───────────────────────────────────────

  const handleCompleteEvent = useCallback(
    (payload: TutorTurnCompleteEvent) => {
      // Compute which hint tier was delivered. Prefer server-provided pre-call hintsUsed
      const prevHintsRemaining = hintsRemaining;
      const preHintsUsedLocal = Math.max(0, 3 - prevHintsRemaining);
      const deliveredTier = typeof payload.hintsUsedDuringTurn === 'number' ? payload.hintsUsedDuringTurn + 1 : preHintsUsedLocal + 1;

      setHintsRemaining(payload.hintsRemaining);
      if (payload.stage && payload.stage !== currentStageRef.current) {
        insertStageDivider(payload.stage);
        currentStageRef.current = payload.stage;
        setCurrentStage(payload.stage);
      }
      if (payload.sessionComplete) {
        onSessionComplete({
          tag: payload.tag,
          stage: payload.stage,
          turnNumber: payload.turnNumber,
          hintsUsed: 3 - payload.hintsRemaining,
        });
      } else {
        scheduleInactivity();
      }

      // If this turn was a hint offer, show a short banner indicating which tier
      if (payload.tag === 'HINT_OFFER') {
        let text = '';
        if (deliveredTier === 1) text = 'Hint 1 -- Directional nudge (points you to the right idea).';
        else if (deliveredTier === 2) text = 'Hint 2 -- Structural hint (shows the method, not the solution).';
        else if (deliveredTier === 3) text = 'Hint 3 -- Worked scaffold (first step shown).';
        else text = 'All hints exhausted -- full solution + isomorphic problem provided.';

        setHintBanner({ tier: deliveredTier, text });
        if (hintBannerTimerRef.current) clearTimeout(hintBannerTimerRef.current);
        hintBannerTimerRef.current = setTimeout(() => setHintBanner(null), 6000);
      }

      // If the server returned a visualHint (diagram brief), notify consumer and append as an AI message
      // If the server returned a structured contrastiveExplanation, render
      // it as a dedicated UI card in-chat so the student sees the correction clearly.
      const contrast = (payload as any).contrastiveExplanation;
      if (contrast && typeof contrast === 'object' && (contrast.name || contrast.correction)) {
        // Encode artifact as a sentinel-wrapped JSON payload so existing message
        // rendering pipeline can remain unchanged while we add a new card type.
        const sentinel = '__MISCONCEPTION__';
        const json = JSON.stringify(contrast);
        const cMsg: ChatMessage = { id: makeId('ai'), role: 'ai', content: `${sentinel}${json}`, isStreaming: false };
        setItems((prev) => [...prev, { kind: 'msg', msg: cMsg }]);
      }

      if (typeof (payload as any).visualHint === 'string' && String((payload as any).visualHint).trim()) {
        const viz = String((payload as any).visualHint).trim();
        // Inform whiteboard shell / panel so it can parse & replay the diagram
        try { onVisualHintRef.current?.(viz); } catch {}
        const vizMsg: ChatMessage = { id: makeId('ai'), role: 'ai', content: viz, isStreaming: false };
        setItems((prev) => [...prev, { kind: 'msg', msg: vizMsg }]);
      }
    },
    [onSessionComplete, scheduleInactivity, insertStageDivider, hintsRemaining],
  );

  const handleErrorEvent = useCallback(
    (payload: TutorErrorEvent) => {
      finalizeAiMessage();
      setIsStreaming(false);
      setIsTyping(false);
      if (payload.code === 'JAILBREAK_DETECTED') {
        setConnectionError(
          'Your message could not be processed safely. Please rephrase.',
        );
      } else {
        setConnectionError('Teacher Vidya will be right back. Please try again in a moment.');
      }
    },
    [finalizeAiMessage],
  );

  // ── SSE stream ────────────────────────────────────────────────────────────

  async function streamTutorTurn(message: string): Promise<boolean> {
    setIsStreaming(true);
    setConnectionError(null);

    let response: Response;
    try {
      response = await fetch('/api/tutor/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, studentMessage: message, turnNumber: Date.now() }),
      });
    } catch {
      setConnectionError('Teacher Vidya will be right back. Please try again in a moment.');
      setIsStreaming(false);
      setIsTyping(false);
      return false;
    }

    if (!response.ok || !response.body) {
      setConnectionError('Teacher Vidya will be right back. Please try again in a moment.');
      setIsStreaming(false);
      setIsTyping(false);
      return false;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const evt of parseSseChunk(chunk)) {
          if (evt.event === 'token') {
            const text =
              typeof (evt.data as { chunk?: string })?.chunk === 'string'
                ? stripTag((evt.data as { chunk: string }).chunk)
                : '';
            if (text) appendAiChunk(text);
          } else if (evt.event === 'complete') {
            finalizeAiMessage();
            handleCompleteEvent(evt.data as TutorTurnCompleteEvent);
          } else if (evt.event === 'error') {
            handleErrorEvent(evt.data as TutorErrorEvent);
          }
        }
      }
    } catch {
      setConnectionError('Teacher Vidya will be right back. Please try again in a moment.');
      return false;
    } finally {
      setIsStreaming(false);
      setIsTyping(false);
    }
    return true;
  }

  // ── Reconnect logic ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!connectionError) {
      setIsReconnecting(false);
      return;
    }
    if (reconnectAttempts >= MAX_RECONNECT) return;

    setIsReconnecting(true);
    const delay = [3000, 6000, 12000][reconnectAttempts] ?? 12000;
    const t = setTimeout(async () => {
      // Attempt a lightweight no-op turn to re-establish; failures increment counter
      const ok = await streamTutorTurn('__PING__');
      if (ok) {
        setConnectionError(null);
        setReconnectAttempts(0);
      } else {
        setReconnectAttempts((n) => n + 1);
      }
      setIsReconnecting(false);
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionError, reconnectAttempts]);

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessageInternal(message: string, isAutoAction = false) {
    if (!message.trim()) return;
    clearInactivityTimer();
    setShowInactivityPrompt(false);
    if (!isAutoAction) addStudentMessage(message);
    startAiMessage();
    await streamTutorTurn(message);
  }

  const handleSend = useCallback(() => {
    if (isStreaming || !inputValue.trim()) return;
    const msg = inputValue.trim();
    setInputValue('');
    void sendMessageInternal(msg, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, isStreaming]);

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    setInputValue(e.target.value);
    // Dismiss inactivity prompt as soon as student starts typing
    if (showInactivityPrompt) setShowInactivityPrompt(false);
    clearInactivityTimer();
  };

  // ── Inactivity prompt actions ──────────────────────────────────────────────

  function handleInactivityYes() {
    setShowInactivityPrompt(false);
    void sendMessageInternal('__HINT_REQUEST__', true);
  }

  function handleInactivityNo() {
    setShowInactivityPrompt(false);
    scheduleInactivity();
  }

  // ── Hint bar action ────────────────────────────────────────────────────────

  function handleGetHint() {
    if (isStreaming || hintsRemaining <= 0) return;
    void sendMessageInternal('__HINT_REQUEST__', true);
  }

  // ── Re-explain style action (AC-04, F-STU-011) ────────────────────────────

  function handleReExplain(sentinel: string) {
    if (isStreaming) return;
    // Show as student message so the chat history reflects the request
    const display = RESTYLE_DISPLAY[sentinel] ?? sentinel;
    addStudentMessage(display);
    startAiMessage();
    void streamTutorTurn(sentinel);
  }

  // Persist a session-level style preference and optionally trigger an immediate re-explain.
  async function handleSetStyle(style: string | null) {
    const s = style || null
    setSelectedStyle(s)
    try {
      await fetch('/api/tutor/session/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, explainStyle: s }),
      })
    } catch (e) {
      logger.debug('AITutorChatPanel: failed to persist style', { sessionId, explainStyle: s, error: String(e) })
    }

    const mapping: Record<string, string> = {
      simpler: '__EXPLAIN_SIMPLER__',
      harder: '__EXPLAIN_HARDER__',
      real_life_example: '__EXPLAIN_EXAMPLE__',
      diagram: '__EXPLAIN_DIAGRAM__',
    }

    if (s && mapping[s]) {
      handleReExplain(mapping[s])
    }
  }

  // ── Render: feature flag ───────────────────────────────────────────────────

  if (!isAITutorEnabled) return null;

  // ── Render: chat items ────────────────────────────────────────────────────

  // Pre-compute which AI messages start a new "Vidya" sequence
  const renderedItems = items.map((item, idx) => {
    if (item.kind === 'divider') return { item, showLabel: false };
    const prev = items[idx - 1];
    const showLabel =
      item.msg.role === 'ai' &&
      (!prev || prev.kind === 'divider' || (prev.kind === 'msg' && prev.msg.role === 'student'));
    return { item, showLabel };
  });

  const showHintBar = !NO_HINT_STAGES.has(currentStage);
  const showReExplainBar = RESTYLE_STAGES.has(currentStage);

  return (
    <>
      <style>{PANEL_STYLE}</style>

      <div className="flex h-full flex-col bg-gray-50 dark:bg-slate-950">

        {/* ① Session header */}
        <div className="sticky top-0 z-10 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {conceptName}
            </h2>
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-full bg-[#EEEDFE] dark:bg-[#534AB7]/20 px-2.5 py-0.5 text-xs font-semibold text-[#534AB7] dark:text-indigo-300">
                {getStageLabel(currentStage)}
              </span>
              <label className="sr-only">Explanation style</label>
              <select
                aria-label="Explanation style"
                value={selectedStyle ?? ''}
                onChange={(e) => handleSetStyle(e.target.value || null)}
                disabled={isStreaming}
                className="text-xs rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-gray-700 dark:text-gray-100"
              >
                <option value="">Off</option>
                <option value="simpler">Simpler</option>
                <option value="harder">Deeper</option>
                <option value="real_life_example">Real-life example</option>
                <option value="diagram">Diagram</option>
              </select>
            </div>
          </div>

          {/* ② Stage strip */}
          <StageStrip currentStage={currentStage} />
        </div>

        {/* ③ Chat history */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 pt-4">
          {items.length === 0 && !isTyping && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Teacher Vidya will guide you through this concept. Type your answer or question below.
            </p>
          )}

          {renderedItems.map(({ item, showLabel }) => {
            if (item.kind === 'divider') {
              return <StageDivider key={item.id} label={item.label} />;
            }
            const { msg } = item;
            if (msg.role === 'ai') {
              // Hide the bubble until a token arrives (isTyping is shown instead)
              if (msg.isStreaming && !hasReceivedTokenRef.current && isTyping) return null;
              return <AiMessageBubble key={msg.id} msg={msg} showLabel={showLabel} />;
            }
            return <StudentMessageBubble key={msg.id} msg={msg} />;
          })}

          {/* AI typing indicator -- three dots before first token */}
          {isTyping && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* ④ Hint tier banner (transient) */}
        {hintBanner && (
          <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 dark:border-indigo-700/40 dark:bg-indigo-900/10">
            <p className="text-xs text-indigo-800 dark:text-indigo-200">{hintBanner.text}</p>
            <div className="text-xs text-indigo-600 dark:text-indigo-300">Tier {hintBanner.tier}</div>
          </div>
        )}

        {/* ④ Hint bar */}
        {showHintBar && (
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Hints: {Math.max(hintsRemaining, 0)} / 3
            </span>
            <button
              type="button"
              onClick={handleGetHint}
              disabled={isStreaming || hintsRemaining <= 0}
              className="min-h-[44px] px-3 text-xs font-semibold text-[#534AB7] dark:text-indigo-300 disabled:cursor-not-allowed disabled:text-gray-400 dark:disabled:text-gray-600"
            >
              {hintsRemaining <= 0 ? 'No hints remaining' : 'Get a hint'}
            </button>
          </div>
        )}

        {/* ④b Re-explain style bar (AC-04, F-STU-011) */}
        {showReExplainBar && (
          <ReExplainBar onSelect={handleReExplain} disabled={isStreaming} />
        )}

        {/* ⑤ Inactivity prompt */}
        {showInactivityPrompt && (
          <div className="v2-inactivity mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Still working on it? Want a hint?
            </p>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={handleInactivityYes}
                className="min-h-[44px] px-3 text-xs font-semibold text-[#534AB7] dark:text-indigo-300"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={handleInactivityNo}
                className="min-h-[44px] px-3 text-xs text-gray-500 dark:text-gray-400"
              >
                No
              </button>
            </div>
          </div>
        )}

        {/* ⑥ SSE error banner */}
        {connectionError && (
          <div className="flex items-center gap-2 border-t border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-2">
            {isReconnecting && reconnectAttempts < MAX_RECONNECT && (
              <svg
                className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-600 dark:text-amber-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            )}
            <p className="flex-1 text-xs text-amber-800 dark:text-amber-200">
              {reconnectAttempts >= MAX_RECONNECT
                ? 'Teacher Vidya will be right back. Refresh to continue.'
                : connectionError}
            </p>
            {reconnectAttempts >= MAX_RECONNECT && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="shrink-0 rounded-md border border-amber-400 dark:border-amber-600 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200 min-h-[44px]"
              >
                Refresh
              </button>
            )}
          </div>
        )}

        {/* ⑦ Input bar */}
            <div className="border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 input-bar-safe">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              className="min-h-[44px] flex-1 resize-none overflow-y-auto rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#534AB7] focus:outline-none focus:ring-1 focus:ring-[#534AB7] disabled:opacity-50"
              placeholder="Type your answer..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              aria-label="Your answer"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isStreaming || !inputValue.trim()}
              aria-label="Send"
              className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-[#534AB7] text-white shadow-md shadow-[#534AB7]/25 transition-all hover:bg-[#4840a3] active:scale-95 disabled:bg-gray-300 dark:disabled:bg-slate-700"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    </>
  );
};

export default AITutorChatPanel;
