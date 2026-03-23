'use client';

/**
 * AITutorChatPanel -- v2
 *
 * Full-height flex-column layout:
 *   ① Session header  -- topic name + stage badge (sticky)
 *   ② Stage strip     -- 7 chips, scrollable, done/active/pending states
 *   ③ Chat history    -- flex-1, overflow-y-auto, smooth scroll to bottom
 *   ④ Hint bar        -- hidden during non-practice stages
 *   ⑤ Inactivity prompt -- pulsing banner after 90s silence
 *   ⑥ SSE error banner -- reconnecting spinner / refresh fallback
 *   ⑦ Input bar       -- auto-resize textarea + circular send button (sticky)
 *
 * Copy rules: no "broke/missed/failed" -- forward-looking tone only.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { stripTag } from '@/lib/ai/tutor/tagParser';

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
  onSessionComplete: (summary: { tag: string; stage: string; turnNumber: number }) => void;
}

type TutorTurnCompleteEvent = {
  tag: string;
  stage: string;
  hintsRemaining: number;
  turnNumber: number;
  sessionComplete: boolean;
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
          ? 'bg-[#EAF3DE] text-[#1D9E75] dark:bg-[#1D9E75]/15 dark:text-green-300'
          : active
          ? 'bg-[#534AB7] text-white'
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
          <span className="v2-dot" style={{ animationDelay: '0ms' }} aria-hidden />
          <span className="v2-dot" style={{ animationDelay: '200ms' }} aria-hidden />
          <span className="v2-dot" style={{ animationDelay: '400ms' }} aria-hidden />
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
  return (
    <div className="v2-msg-appear mb-3 flex flex-col items-start">
      {showLabel && (
        <div className="mb-1 ml-1 flex items-center gap-1.5">
          <Image
            src="/logos/vidya/vidya-avatar-64.png"
            alt="Vidya"
            width={32}
            height={32}
            className="rounded-full flex-shrink-0"
          />
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
            Teacher Vidya
          </span>
        </div>
      )}
      <div className="max-w-[85%] rounded-[4px_12px_12px_12px] bg-[#EEEDFE] px-3 py-2.5 text-sm leading-relaxed text-[#3C3489] dark:bg-[#534AB7]/20 dark:text-[#EEEDFE] whitespace-pre-wrap break-words">
        {msg.content || '\u200B' /* zero-width space keeps bubble visible when empty */}
        {msg.isStreaming && (
          <span className="v2-cursor text-[#534AB7]/50 dark:text-[#EEEDFE]/50">|</span>
        )}
      </div>
    </div>
  );
}

function StudentMessageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="v2-msg-appear mb-3 flex justify-end">
      <div className="max-w-[75%] rounded-[12px_4px_12px_12px] bg-[#534AB7] px-3 py-2.5 text-sm leading-relaxed text-white whitespace-pre-wrap break-words">
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

// ── Main component ─────────────────────────────────────────────────────────────

export const AITutorChatPanel: React.FC<AITutorChatPanelProps> = ({
  sessionId,
  conceptName,
  subjectName: _subjectName,
  initialStage,
  isAITutorEnabled,
  onSessionComplete,
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAiMsgIdRef = useRef<string | null>(null);
  const currentStageRef = useRef(initialStage);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasReceivedTokenRef = useRef(false); // first token received this turn?

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
    return () => {
      clearInactivityTimer();
    };
  }, [clearInactivityTimer]);

  // ── Message helpers ────────────────────────────────────────────────────────

  const addStudentMessage = useCallback((content: string) => {
    const msg: ChatMessage = { id: makeId('s'), role: 'student', content };
    setItems((prev) => [...prev, { kind: 'msg', msg }]);
  }, []);

  const startAiMessage = useCallback(() => {
    const id = makeId('ai');
    lastAiMsgIdRef.current = id;
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
    lastAiMsgIdRef.current = null;
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
        });
      } else {
        scheduleInactivity();
      }
    },
    [onSessionComplete, scheduleInactivity, insertStageDivider],
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
            <span className="shrink-0 rounded-full bg-[#EEEDFE] dark:bg-[#534AB7]/20 px-2.5 py-0.5 text-xs font-semibold text-[#534AB7] dark:text-indigo-300">
              {getStageLabel(currentStage)}
            </span>
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
        <div
          className="border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        >
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
