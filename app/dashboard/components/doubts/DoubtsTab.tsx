/**
 * FILE OBJECTIVE:
 * - Doubts/Ask AI tab for student dashboard.
 * - Text-based question input with encouraging, child-safe tone.
 * - Integrates with existing ChatPanel for AI responses.
 *
 * LINKED UNIT TEST:
 * - __tests__/app/dashboard/components/doubts/DoubtsTab.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created DoubtsTab per PRD specifications
 */
'use client';

import React, { useState, useCallback } from 'react';

interface DoubtsTabProps {
  /** Callback when user submits a question */
  onAskQuestion?: (question: string, subject?: string) => void;
  /** Whether AI is currently generating a response */
  isLoading?: boolean;
}

/** Subject options for quick categorization */
const SUBJECTS = [
  { id: 'math', label: '🔢 Math', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { id: 'science', label: '🔬 Science', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { id: 'english', label: '📖 English', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { id: 'social', label: '🌍 Social Studies', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { id: 'other', label: '❓ Other', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
];

/** Example questions to help students get started */
const EXAMPLE_QUESTIONS = [
  "Can you explain fractions with an example?",
  "Why does the sun rise in the east?",
  "How do I find the area of a triangle?",
  "What is photosynthesis?",
];

/**
 * DoubtsTab - Ask AI questions in a child-safe, encouraging environment
 *
 * Design Principles (from PRD):
 * - Encouraging tone: Never shame for asking questions
 * - Child-safe: Age-appropriate language, no scary errors
 * - Simple input: Text box with optional subject selection
 * - Helpful examples: Show sample questions to get started
 */
export function DoubtsTab({ onAskQuestion, isLoading = false }: DoubtsTabProps) {
  const [question, setQuestion] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuestion = question.trim();
    if (trimmedQuestion && !isLoading) {
      onAskQuestion?.(trimmedQuestion, selectedSubject || undefined);
      setQuestion('');
    }
  }, [question, selectedSubject, isLoading, onAskQuestion]);

  const handleExampleClick = useCallback((example: string) => {
    setQuestion(example);
  }, []);

  return (
    <div className="space-y-6 pb-24 px-4 sm:px-6">
      {/* Header */}
      <div className="text-center pt-4">
        <h1 className="text-2xl font-bold text-foreground">Ask a Question</h1>
        <p className="text-muted-foreground mt-1">
          No question is too small! I&apos;m here to help you learn. 🌟
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
            className="w-full min-h-[120px] p-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!question.trim() || isLoading}
          className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-lg transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Thinking...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Ask My Tutor
            </span>
          )}
        </button>
      </form>

      {/* Example Questions */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">
          💡 Not sure what to ask? Try one of these:
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

      {/* Encouraging Footer */}
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">
          🎓 Asking questions is how we learn. Keep being curious!
        </p>
      </div>
    </div>
  );
}

export default DoubtsTab;
