'use client';
/**
 * FILE OBJECTIVE:
 * - Slide-up doubt panel for any session phase.
 * - F-STU-011 AC-03 (MUST): student can interrupt at any point to ask a doubt.
 * - Calls POST /api/doubts with session context. Maintains conversation history
 *   for follow-up questions within the same panel session.
 * - AI pauses the current phase implicitly; student closes panel to resume.
 * - Controlled externally via isOpen / onClose -- trigger lives in SessionBottomBar.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/session/DoubtPanel.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created to close F-STU-011 AC-03 gap
 * - 2026-04-07 | claude | fix: add object-cover to avatars and use items-start on message rows to prevent avatar stretching
 * - 2026-04-22 | redesign | remove internal floating FAB; accept isOpen/onClose props
 * - 2026-05-08T00:00:00Z | copilot | render doubts follow-up questions as clickable bubbles and submit them as new questions
 * - 2026-05-08T00:00:00Z | copilot | open subscription paywall for free-limit doubts responses instead of showing a connection error
 * - 2026-05-11T00:00:00Z | claude | add timestamp to Message state (stable per-message); align ConversationMessage
 *   interface with schemas.ts contract; add data.response fallback to GENERIC_CONNECTION_ERROR
 * - 2026-05-12T00:00:00Z | copilot | add voice dictation input and read-aloud controls for Vidya answers
 */

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import ContentModal from '@/components/UI/ContentModal';
import { UpgradeFlow } from '@/components/student/subscription/UpgradeFlow';
import { logger } from '@/lib/logger';
import { Speech, createSpeechController } from '@/lib/speech';

const DOUBTS_API_PATH = '/api/doubts';
const FREE_LIMIT_REACHED_ERROR = 'free_limit_reached';
const GENERIC_CONNECTION_ERROR = 'I could not connect right now. Please try again in a moment.';
const PAYWALL_MODAL_TITLE = 'Continue asking Teacher Vidya';

interface Message {
  role: 'student' | 'vidya';
  text: string;
  timestamp: string;
  followUps?: string[];
}

interface ConversationMessage {
  role: 'student' | 'tutor';
  content: string;
  timestamp: string;
}

interface DoubtPanelProps {
  subject: string;
  chapter: string;
  topicName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DoubtPanel({ subject, chapter, topicName, isOpen, onClose }: DoubtPanelProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [questionId, setQuestionId] = React.useState<string | null>(null);
  const [isPaywallOpen, setIsPaywallOpen] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [playingMessageKey, setPlayingMessageKey] = React.useState<string | null>(null);

  function normalizeFollowUpQuestions(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const speechControllerRef = useRef<ReturnType<typeof createSpeechController> | null>(null);

  function stopVoiceInput() {
    try {
      speechControllerRef.current?.stop();
    } catch {
      // ignore recognition shutdown errors
    }

    speechControllerRef.current = null;
    setIsListening(false);
  }

  function getSpeechLanguage(text: string) {
    return /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-US';
  }

  function handlePlayMessage(message: Message, messageKey: string) {
    try {
      Speech.stop();
      Speech.speak(message.text, { lang: getSpeechLanguage(message.text) });
      setPlayingMessageKey(messageKey);
    } catch (err) {
      logger.error('Doubt panel TTS error', { error: String(err) });
      setPlayingMessageKey(null);
    }
  }

  function handleStopMessagePlayback() {
    try {
      Speech.stop();
    } catch {
      // ignore speech synthesis shutdown errors
    }

    setPlayingMessageKey(null);
  }

  function startVoiceInput() {
    if (loading || isListening) {
      return;
    }

    setInput('');

    try {
      const controller = createSpeechController({
        lang: 'en-US',
        onInterim: (text) => {
          setInput(text);
        },
        onFinal: (text) => {
          setInput(text);
          setIsListening(false);
          speechControllerRef.current = null;
        },
        onError: (message) => {
          logger.error('Doubt panel voice input error', { error: message });
          setIsListening(false);
          speechControllerRef.current = null;
        },
      });

      if (!controller) {
        logger.error('Doubt panel voice input unavailable', { error: 'Speech recognition not supported' });
        return;
      }

      speechControllerRef.current = controller;
      setIsListening(true);
      controller.start();
    } catch (err) {
      logger.error('Doubt panel voice input error', { error: String(err) });
      stopVoiceInput();
    }
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => () => {
    stopVoiceInput();
    handleStopMessagePlayback();
  }, []);

  // Focus input and seed greeting when panel opens
  useEffect(() => {
    if (!isOpen) return;
    if (inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
    if (messages.length === 0) {
      setMessages([
        {
          role: 'vidya',
          text: `Hi! I am Teacher Vidya. What is confusing you about "${topicName}"? Ask me anything -- no question is too small.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [isOpen, topicName, messages.length]);

  function buildHistory(): ConversationMessage[] {
    return messages
      .filter((m) => m.role !== 'vidya' || messages.indexOf(m) > 0)
      .map((m) => ({
        role: m.role === 'student' ? 'student' : 'tutor',
        content: m.text,
        timestamp: m.timestamp,
      }));
  }

  async function submitDoubt(nextQuestion?: string) {
    stopVoiceInput();
    const q = (nextQuestion ?? input).trim();
    if (!q || loading) return;

    if (!nextQuestion) {
      setInput('');
    }
    setMessages((prev) => [...prev, { role: 'student', text: q, timestamp: new Date().toISOString() }]);
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        question: q,
        subject,
        chapter,
        topic: topicName,
        intent: 'conceptual_clarity',
        conversationHistory: buildHistory(),
      };
      if (questionId) body.questionId = questionId;

      const res = await fetch(DOUBTS_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({})) as {
        error?: string;
        questionId?: string;
        response?: string;
        followUpQuestions?: string[];
      };

      if (!res.ok) {
        if (data.error === FREE_LIMIT_REACHED_ERROR) {
          setIsPaywallOpen(true);
          return;
        }

        throw new Error('Request failed');
      }

      if (!questionId) setQuestionId(data.questionId);

      setMessages((prev) => [
        ...prev,
        {
          role: 'vidya',
          text: data.response ?? GENERIC_CONNECTION_ERROR,
          timestamp: new Date().toISOString(),
          followUps: normalizeFollowUpQuestions(data.followUpQuestions),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'vidya',
          text: GENERIC_CONNECTION_ERROR,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitDoubt();
    }
  }

  return (
    <>
      <ContentModal
        open={isPaywallOpen}
        title={PAYWALL_MODAL_TITLE}
        onClose={() => setIsPaywallOpen(false)}
        className="max-w-xl"
      >
        <UpgradeFlow />
      </ContentModal>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-up panel */}
      <div
        role="dialog"
        aria-label="Ask Teacher Vidya"
        aria-modal="true"
        className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-background rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        } max-h-[80vh] min-h-[320px]`}
      >
        {/* Panel header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50 flex-shrink-0">
          <Image
            src="/logos/vidya/vidya-avatar-64.png"
            alt="Teacher Vidya"
            width={36}
            height={36}
            className="rounded-full flex-shrink-0 object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Teacher Vidya</p>
            <p className="text-xs text-muted-foreground truncate">{topicName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close doubt panel"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {messages.map((msg, i) => {
            const messageKey = `${msg.timestamp}-${i}`;
            const isPlaying = playingMessageKey === messageKey;

            return (
              <div
                key={messageKey}
                className={`flex items-start gap-2.5 ${msg.role === 'student' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {msg.role === 'vidya' && (
                  <Image
                    src="/logos/vidya/vidya-avatar-64.png"
                    alt="Vidya"
                    width={28}
                    height={28}
                    className="rounded-full flex-shrink-0 mt-0.5 object-cover"
                  />
                )}
                <div
                  className={`max-w-[80%] space-y-1.5 ${msg.role === 'student' ? 'items-end' : 'items-start'} flex flex-col`}
                >
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'student'
                        ? 'bg-[#534AB7] text-white rounded-tr-sm'
                        : 'bg-[#EEEDFE] dark:bg-[#534AB7]/15 text-foreground rounded-tl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.role === 'vidya' && (
                    <div className="flex items-center gap-2 px-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (isPlaying) {
                            handleStopMessagePlayback();
                            return;
                          }

                          handlePlayMessage(msg, messageKey);
                        }}
                        aria-label={isPlaying ? 'Stop reading answer aloud' : 'Read answer aloud'}
                        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-border/50 bg-background text-sm transition-colors ${
                          isPlaying
                            ? 'text-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/15'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {isPlaying ? '⏹' : '🔊'}
                      </button>
                    </div>
                  )}
                  {msg.role === 'vidya' && Array.isArray(msg.followUps) && msg.followUps.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-1">
                      {msg.followUps.map((followUpQuestion, followUpIndex) => (
                        <button
                          key={`${i}-follow-up-${followUpIndex}`}
                          type="button"
                          onClick={() => {
                            void submitDoubt(followUpQuestion);
                          }}
                          disabled={loading}
                          className="min-h-[44px] rounded-full bg-[#EEEDFE] px-3 py-2 text-left text-xs font-medium text-[#534AB7] transition-colors hover:bg-[#dcd9fd] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#534AB7]/15 dark:text-indigo-300 dark:hover:bg-[#534AB7]/25"
                        >
                          {followUpQuestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-2.5">
              <Image
                src="/logos/vidya/vidya-avatar-64.png"
                alt="Vidya"
                width={28}
                height={28}
                className="rounded-full flex-shrink-0 mt-0.5 object-cover"
              />
              <div className="bg-[#EEEDFE] dark:bg-[#534AB7]/15 px-3.5 py-3 rounded-2xl rounded-tl-sm">
                <span className="flex gap-1 items-center">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#534AB7] animate-bounce [animation-delay:0ms]"
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#534AB7] animate-bounce [animation-delay:150ms]"
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#534AB7] animate-bounce [animation-delay:300ms]"
                  />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border/50">
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (isListening) {
                  stopVoiceInput();
                  return;
                }

                startVoiceInput();
              }}
              disabled={loading}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              className={`flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-border transition-colors ${
                isListening
                  ? 'bg-[#EEEDFE] text-[#534AB7] dark:bg-[#534AB7]/15'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              } disabled:opacity-40`}
            >
              {isListening ? '⏹' : '🎤'}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={isListening ? 'Listening...' : 'Type or speak your doubt here...'}
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#534AB7]/40 disabled:opacity-50 min-h-[44px] max-h-[120px]"
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
              }}
            />
            <button
              type="button"
              onClick={() => {
                void submitDoubt();
              }}
              disabled={!input.trim() || loading}
              aria-label="Send doubt"
              className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#534AB7] text-white disabled:opacity-40 hover:bg-[#3C3489] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
          {isListening && (
            <p className="text-[11px] text-[#534AB7] mt-1.5 text-center">
              Listening for your doubt. Tap send when the transcription looks right.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
            Press Enter to send -- Shift+Enter for a new line
          </p>
        </div>
      </div>
    </>
  );
}

export default DoubtPanel;