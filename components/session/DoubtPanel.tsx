'use client';
/**
 * FILE OBJECTIVE:
 * - Floating "Ask Vidya" button + slide-up doubt panel for any session phase.
 * - F-STU-011 AC-03 (MUST): student can interrupt at any point to ask a doubt.
 * - Calls POST /api/doubts with session context. Maintains conversation history
 *   for follow-up questions within the same panel session.
 * - AI pauses the current phase implicitly; student closes panel to resume.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created to close F-STU-011 AC-03 gap
 */

import React, { useRef, useEffect } from 'react';
import Image from 'next/image';

interface Message {
  role: 'student' | 'vidya';
  text: string;
  followUp?: string;
}

interface ConversationMessage {
  role: 'student' | 'tutor';
  content: string;
}

interface DoubtPanelProps {
  subject: string;
  chapter: string;
  topicName: string;
}

export function DoubtPanel({ subject, chapter, topicName }: DoubtPanelProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [questionId, setQuestionId] = React.useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  function open() {
    setIsOpen(true);
    if (messages.length === 0) {
      setMessages([
        {
          role: 'vidya',
          text: `Hi! I am Teacher Vidya. What is confusing you about "${topicName}"? Ask me anything -- no question is too small.`,
        },
      ]);
    }
  }

  function close() {
    setIsOpen(false);
  }

  function buildHistory(): ConversationMessage[] {
    return messages
      .filter((m) => m.role !== 'vidya' || messages.indexOf(m) > 0)
      .map((m) => ({
        role: m.role === 'student' ? 'student' : 'tutor',
        content: m.text,
      }));
  }

  async function send() {
    const q = input.trim();
    if (!q || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'student', text: q }]);
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

      const res = await fetch('/api/doubts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Request failed');

      const data = await res.json() as {
        questionId: string;
        response: string;
        followUpQuestion: string;
      };

      if (!questionId) setQuestionId(data.questionId);

      setMessages((prev) => [
        ...prev,
        {
          role: 'vidya',
          text: data.response,
          followUp: data.followUpQuestion,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'vidya',
          text: "I could not connect right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating button -- always visible during active session phases */}
      {!isOpen && (
        <button
          type="button"
          onClick={open}
          aria-label="Ask Teacher Vidya a doubt"
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-full bg-[#534AB7] text-white text-sm font-semibold shadow-lg shadow-[#534AB7]/30 hover:bg-[#3C3489] transition-colors"
        >
          <Image
            src="/logos/vidya/vidya-avatar-64.png"
            alt=""
            width={24}
            height={24}
            className="rounded-full"
          />
          Ask Vidya
        </button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={close}
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
        }`}
        style={{ maxHeight: '80vh', minHeight: '320px' }}
      >
        {/* Panel header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50 flex-shrink-0">
          <Image
            src="/logos/vidya/vidya-avatar-64.png"
            alt="Teacher Vidya"
            width={36}
            height={36}
            className="rounded-full flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Teacher Vidya</p>
            <p className="text-xs text-muted-foreground truncate">{topicName}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close doubt panel"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
        >
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === 'student' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.role === 'vidya' && (
                <Image
                  src="/logos/vidya/vidya-avatar-64.png"
                  alt="Vidya"
                  width={28}
                  height={28}
                  className="rounded-full flex-shrink-0 mt-0.5"
                />
              )}
              <div className={`max-w-[80%] space-y-1.5 ${msg.role === 'student' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'student'
                      ? 'bg-[#534AB7] text-white rounded-tr-sm'
                      : 'bg-[#EEEDFE] dark:bg-[#534AB7]/15 text-foreground rounded-tl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                {/* Follow-up question from Vidya */}
                {msg.role === 'vidya' && msg.followUp && (
                  <p className="text-xs text-[#534AB7] dark:text-indigo-300 px-1">
                    {msg.followUp}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-2.5">
              <Image
                src="/logos/vidya/vidya-avatar-64.png"
                alt="Vidya"
                width={28}
                height={28}
                className="rounded-full flex-shrink-0 mt-0.5"
              />
              <div className="bg-[#EEEDFE] dark:bg-[#534AB7]/15 px-3.5 py-3 rounded-2xl rounded-tl-sm">
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#534AB7] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#534AB7] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#534AB7] animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border/50">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type your doubt here..."
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#534AB7]/40 disabled:opacity-50 min-h-[44px] max-h-[120px]"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
              }}
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || loading}
              aria-label="Send doubt"
              className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#534AB7] text-white disabled:opacity-40 hover:bg-[#3C3489] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
            Press Enter to send -- Shift+Enter for a new line
          </p>
        </div>
      </div>
    </>
  );
}

export default DoubtPanel;
