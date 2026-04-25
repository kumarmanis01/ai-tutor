'use client';

import { useCallback, useState } from 'react';

export function useSubmitSessionRating(sessionId: string) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (params: { rating: number; feedback?: string }) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/student/session/${encodeURIComponent(sessionId)}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: params.rating, feedback: params.feedback }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) {
          throw new Error(typeof json?.error === 'string' ? json.error : 'Request failed');
        }
        return true;
      } catch (e) {
        setError("Couldn't save rating, try again");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId]
  );

  return { submit, submitting, error };
}
