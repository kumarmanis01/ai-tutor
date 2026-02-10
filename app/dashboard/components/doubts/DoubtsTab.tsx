'use client';

import React, { useState, useCallback } from 'react';

interface DoubtsMessage {
  id: string;
  from: 'user' | 'ai';
  text: string;
  followUp?: string;
}

interface DoubtsTabProps {
  /** Legacy callback - kept for backward compat but no longer switches tabs */
  onAskQuestion?: (question: string, subject?: string) => void;
  isLoading?: boolean;
}

const SUBJECTS = [
  { id: 'math', label: 'Math', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { id: 'science', label: 'Science', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { id: 'english', label: 'English', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { id: 'social', label: 'Social Studies', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { id: 'other', label: 'Other', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
];

const EXAMPLE_QUESTIONS = [
  "Can you explain fractions with an example?",
  "Why does the sun rise in the east?",
  "How do I find the area of a triangle?",
  "What is photosynthesis?",
];

/**
 * DoubtsTab - Ask AI questions via /api/doubts with inline chat display.
 * Persists questions to StudentQuestion model and shows AI responses inline.
 */
export function DoubtsTab({ onAskQuestion, isLoading: _externalLoading = false }: DoubtsTabProps) {
  const [question, setQuestion] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [messages, setMessages] = useState<DoubtsMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const userMsg: DoubtsMessage = {
      id: `u-${Date.now()}`,
      from: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setLoading(true);

    // Also notify legacy callback if provided
    onAskQuestion?.(trimmed, selectedSubject || undefined);

    try {
      const res = await fetch('/api/doubts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          subject: selectedSubject || undefined,
          intent: 'conceptual_clarity',
          questionId: currentQuestionId || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            from: 'ai',
            text: data?.error || 'Something went wrong. Please try again!',
          },
        ]);
        return;
      }

      // Store questionId for follow-up questions
      if (data.questionId) setCurrentQuestionId(data.questionId);

      const aiMsg: DoubtsMessage = {
        id: `a-${Date.now()}`,
        from: 'ai',
        text: data.response || 'I could not generate a response. Please try again.',
        followUp: data.followUpQuestion,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          from: 'ai',
          text: 'Network error. Please check your connection and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [question, selectedSubject, loading, currentQuestionId, onAskQuestion]);

  const handleExampleClick = useCallback((example: string) => {
    setQuestion(example);
  }, []);

  const handleFollowUpClick = useCallback((followUp: string) => {
    setQuestion(followUp);
  }, []);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setCurrentQuestionId(null);
    setQuestion('');
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div className="space-y-4 pb-24 px-4 sm:px-6">
      {/* Header */}
      <div className="text-center pt-4">
        <h1 className="text-2xl font-bold text-foreground">Ask a Question</h1>
        <p className="text-muted-foreground mt-1">
          No question is too small! I&apos;m here to help you learn.
        </p>
      </div>

      {/* Subject Selection */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          What subject is this about? (optional)
        </label>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((subject) => (
            <button
              key={subject.id}
              type="button"
              onClick={() => setSelectedSubject(
                selectedSubject === subject.id ? null : subject.id
              )}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedSubject === subject.id
                  ? `${subject.color} ring-2 ring-primary ring-offset-2`
                  : `${subject.color} opacity-70 hover:opacity-100`
              }`}
            >
              {subject.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      {hasMessages && (
        <div className="space-y-3 max-h-96 overflow-y-auto rounded-xl bg-muted/20 dark:bg-slate-800/20 p-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${msg.from === 'user' ? 'order-1' : ''}`}>
                <div className={`px-3 py-2 rounded-2xl text-sm ${
                  msg.from === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-card dark:bg-slate-700 text-foreground rounded-bl-md border border-border/30'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
                {/* Follow-up question suggestion */}
                {msg.from === 'ai' && msg.followUp && (
                  <button
                    type="button"
                    onClick={() => handleFollowUpClick(msg.followUp!)}
                    className="mt-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-xs transition-all"
                  >
                    {msg.followUp}
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-2xl text-sm bg-card dark:bg-slate-700 text-muted-foreground rounded-bl-md border border-border/30">
                <span className="flex items-center gap-1">
                  Thinking
                  <span className="inline-flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New conversation button (when messages exist) */}
      {hasMessages && (
        <button
          type="button"
          onClick={startNewConversation}
          className="text-sm text-primary hover:underline"
        >
          Ask a new question
        </button>
      )}

      {/* Question Input */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="question-input" className="sr-only">
            Type your question
          </label>
          <textarea
            id="question-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question here... For example: Can you explain how plants make food?"
            className="w-full min-h-[100px] p-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={!question.trim() || loading}
          className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-lg transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Thinking...
            </span>
          ) : (
            'Ask My Tutor'
          )}
        </button>
      </form>

      {/* Example Questions (only shown when no messages yet) */}
      {!hasMessages && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            Not sure what to ask? Try one of these:
          </p>
          <div className="space-y-2">
            {EXAMPLE_QUESTIONS.map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleExampleClick(example)}
                className="w-full text-left p-3 rounded-lg bg-muted/50 hover:bg-muted text-sm text-foreground transition-colors"
              >
                &quot;{example}&quot;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">
          Asking questions is how we learn. Keep being curious!
        </p>
      </div>
    </div>
  );
}

export default DoubtsTab;
