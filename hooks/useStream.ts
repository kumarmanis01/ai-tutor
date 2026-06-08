/**
 * FILE OBJECTIVE:
 * - useStream: reusable hook for consuming SSE streams via fetch + ReadableStream.
 *   Parses SSE lines, fires onToken/onDone/onError callbacks, and supports abort.
 *
 * EDIT LOG:
 * - 2026-06-08T12:00:00Z | claude | initial implementation for /api/ask SSE streaming
 */

import { useRef, useCallback } from 'react';

export interface UseStreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}

export interface UseStreamReturn {
  stream: (url: string, body: object, callbacks: UseStreamCallbacks) => Promise<void>;
  abort: () => void;
}

export function useStream(): UseStreamReturn {
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const stream = useCallback(async (
    url: string,
    body: object,
    { onToken, onDone, onError }: UseStreamCallbacks,
  ): Promise<void> => {
    abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      onError(String((err as { message?: string })?.message || 'fetch_error'));
      return;
    }

    if (!response.ok) {
      onError(`status-${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('no_response_body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();

          if (data === '[DONE]') {
            onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;
            if (typeof parsed.error === 'string') {
              onError(parsed.error);
              return;
            }
            if (typeof parsed.token === 'string') {
              onToken(parsed.token);
            }
          } catch {
            // Ignore malformed SSE data lines
          }
        }
      }

      // Stream ended without [DONE] -- treat as completion
      onDone();
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      onError(String((err as { message?: string })?.message || 'stream_error'));
    } finally {
      try { reader.cancel(); } catch { /* ignore */ }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [abort]);

  return { stream, abort };
}
