'use client';

/**
 * FILE OBJECTIVE:
 * - Monitor consent status for a given token.
 *   Primary: WebSocket (Socket.IO) subscribes to consent:{token} room.
 *   Fallback: HTTP poll every 15 seconds if WS fails or times out (3s).
 *   Exports live status, expiry, masked contact, channel, and reminder count.
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useConsentStatus.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created (polling only)
 * - 2026-04-28T00:00:00Z | staff-engineer | add WebSocket primary + polling fallback per S0.3 spec
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type ConsentStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';

export interface ConsentStatusResult {
  status: ConsentStatus | null;
  expiresAt: string | null;
  sentTo: string | null;
  channel: string | null;
  reminderCount: number;
  error: string | null;
  loading: boolean;
}

const POLL_INTERVAL_MS = 15_000;
const WS_CONNECT_TIMEOUT_MS = 3_000;

async function fetchStatus(consentToken: string): Promise<Omit<ConsentStatusResult, 'loading'>> {
  const res = await fetch(
    `/api/v1/consent/status?consent_token=${encodeURIComponent(consentToken)}`
  );
  if (!res.ok) {
    return {
      status: null,
      expiresAt: null,
      sentTo: null,
      channel: null,
      reminderCount: 0,
      error: `Request failed: ${res.status}`,
    };
  }
  const data = (await res.json()) as {
    status: ConsentStatus;
    expiresAt: string;
    sentTo: string;
    channel: string;
    reminderCount: number;
  };
  return {
    status: data.status,
    expiresAt: data.expiresAt,
    sentTo: data.sentTo,
    channel: data.channel,
    reminderCount: data.reminderCount,
    error: null,
  };
}

export function useConsentStatus(consentToken: string | null): ConsentStatusResult {
  const [result, setResult] = useState<ConsentStatusResult>({
    status: null,
    expiresAt: null,
    sentTo: null,
    channel: null,
    reminderCount: 0,
    error: null,
    loading: false,
  });

  const wsConnectedRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!consentToken) return;
    setResult((prev) => ({ ...prev, loading: true }));
    try {
      const next = await fetchStatus(consentToken);
      setResult({ ...next, loading: false });
    } catch {
      setResult((prev) => ({ ...prev, loading: false, error: 'Network error' }));
    }
  }, [consentToken]);

  function startPolling() {
    if (pollingRef.current) return;
    void poll();
    pollingRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  useEffect(() => {
    if (!consentToken) return;

    let socketInstance: { emit: (event: string, data?: unknown) => void; disconnect: () => void; on: (event: string, handler: (payload: unknown) => void) => void } | null = null;
    let wsTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    async function attemptWebSocket() {
      let ioFn: ((opts: { path: string; transports: string[] }) => typeof socketInstance) | null = null;
      try {
        const mod = await import('socket.io-client');
        ioFn = mod.io as unknown as typeof ioFn;
      } catch {
        if (mounted) startPolling();
        return;
      }

      if (!ioFn) {
        if (mounted) startPolling();
        return;
      }

      try {
        socketInstance = ioFn({ path: '/api/socket', transports: ['websocket', 'polling'] });

        wsTimeoutId = setTimeout(() => {
          if (!wsConnectedRef.current && mounted) startPolling();
        }, WS_CONNECT_TIMEOUT_MS);

        socketInstance.on('connect', () => {
          wsConnectedRef.current = true;
          if (wsTimeoutId) {
            clearTimeout(wsTimeoutId);
            wsTimeoutId = null;
          }
          socketInstance!.emit('join_consent_room', consentToken);
          // Hydrate state immediately via HTTP (WS won't replay past events).
          void poll();
        });

        socketInstance.on('connect_error', () => {
          if (!wsConnectedRef.current && mounted) startPolling();
        });

        socketInstance.on('consent_approved', (payload: unknown) => {
          const p = payload as { consentToken?: string };
          if (p?.consentToken !== consentToken) return;
          if (mounted) setResult((prev) => ({ ...prev, status: 'APPROVED', error: null }));
        });

        socketInstance.on('consent_denied', (payload: unknown) => {
          const p = payload as { consentToken?: string };
          if (p?.consentToken !== consentToken) return;
          if (mounted) setResult((prev) => ({ ...prev, status: 'DENIED', error: null }));
        });

        socketInstance.on('consent_expired', (payload: unknown) => {
          const p = payload as { consentToken?: string };
          if (p?.consentToken !== consentToken) return;
          if (mounted) setResult((prev) => ({ ...prev, status: 'EXPIRED', error: null }));
        });

        socketInstance.on('disconnect', () => {
          wsConnectedRef.current = false;
          if (mounted) startPolling();
        });
      } catch {
        if (mounted) startPolling();
      }
    }

    void attemptWebSocket();

    return () => {
      mounted = false;
      if (wsTimeoutId) clearTimeout(wsTimeoutId);
      stopPolling();
      if (socketInstance) {
        socketInstance.emit('leave_consent_room', consentToken);
        socketInstance.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentToken]);

  return result;
}
