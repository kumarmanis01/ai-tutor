"use client";
import { useCallback, useState } from 'react';

export function useLearningSessionProgress() {
  const [updating, setUpdating] = useState(false);

  const updateProgress = useCallback(async (sessionId: string, params: {
    totalQuestions?: number;
    answeredCount?: number;
    currentQuestionIndex?: number;
  }) => {
    setUpdating(true);
    try {
      await fetch('/api/learning-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...params })
      });
    } finally {
      setUpdating(false);
    }
  }, []);

  return { updating, updateProgress };
}
