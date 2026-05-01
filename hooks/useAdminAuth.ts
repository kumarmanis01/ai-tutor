/**
 * FILE OBJECTIVE:
 * - Client-side admin auth hook for A0.3 login, MFA verification, refresh rotation, and logout.
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useAdminAuth.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:08:00Z | copilot | created admin auth hook for login/mfa/refresh/logout/device/session-timeout
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const ACCESS_TOKEN_KEY = 'admin_access_token';
const REFRESH_TOKEN_KEY = 'admin_refresh_token';
const DEVICE_TOKEN_KEY = 'admin_device_token';
const LOGIN_AT_KEY = 'admin_login_at';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

interface LoginStartResponse {
  requiresMfa: boolean;
  loginSessionToken?: string;
  accessToken?: string;
  refreshToken?: string;
  lockoutThreshold?: number;
  error?: string;
  message?: string;
}

interface VerifyMfaResponse {
  accessToken: string;
  refreshToken: string;
  deviceToken?: string | null;
}

function readStorage(key: string): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(key) ?? '';
}

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

function clearStorage(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}

export function useAdminAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginSessionToken, setLoginSessionToken] = useState<string>('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const accessToken = useMemo(() => readStorage(ACCESS_TOKEN_KEY), []);

  const markActivity = useCallback(() => {
    writeStorage(LOGIN_AT_KEY, String(Date.now()));
  }, []);

  const clearSession = useCallback(() => {
    clearStorage(ACCESS_TOKEN_KEY);
    clearStorage(REFRESH_TOKEN_KEY);
    clearStorage(DEVICE_TOKEN_KEY);
    clearStorage(LOGIN_AT_KEY);
    setLoginSessionToken('');
    setRequiresMfa(false);
    setSetupRequired(false);
  }, []);

  const scheduleSessionTimeout = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(async () => {
      const now = Date.now();
      const startedAt = Number(readStorage(LOGIN_AT_KEY) || 0);
      if (startedAt && now - startedAt >= SESSION_TIMEOUT_MS) {
        await fetch('/api/v1/admin/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: readStorage(ACCESS_TOKEN_KEY),
            refreshToken: readStorage(REFRESH_TOKEN_KEY),
            deviceToken: readStorage(DEVICE_TOKEN_KEY),
          }),
        }).catch(() => undefined);
        clearSession();
      } else {
        scheduleSessionTimeout();
      }
    }, 30_000);
  }, [clearSession]);

  useEffect(() => {
    const handler = () => {
      if (readStorage(ACCESS_TOKEN_KEY)) {
        markActivity();
      }
    };
    window.addEventListener('mousemove', handler);
    window.addEventListener('keydown', handler);
    window.addEventListener('click', handler);
    scheduleSessionTimeout();
    return () => {
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('click', handler);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [markActivity, scheduleSessionTimeout]);

  const login = useCallback(async (email: string, password: string): Promise<LoginStartResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as LoginStartResponse;
      if (!res.ok) {
        const msg = data.message ?? data.error ?? 'Unable to sign in.';
        setError(msg);
        return data;
      }

      if (data.requiresMfa && data.loginSessionToken) {
        setRequiresMfa(true);
        setLoginSessionToken(data.loginSessionToken);
        setSetupRequired(Boolean((data as any).setupRequired));
        return data;
      }

      if (data.accessToken && data.refreshToken) {
        writeStorage(ACCESS_TOKEN_KEY, data.accessToken);
        writeStorage(REFRESH_TOKEN_KEY, data.refreshToken);
        markActivity();
      }

      return data;
    } finally {
      setIsLoading(false);
    }
  }, [markActivity]);

  const verifyMfa = useCallback(
    async (opts: {
      totpCode?: string;
      backupCode?: string;
      rememberDevice?: boolean;
    }): Promise<VerifyMfaResponse | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/v1/admin/auth/mfa', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loginSessionToken,
            totpCode: opts.totpCode,
            backupCode: opts.backupCode,
            rememberDevice: opts.rememberDevice === true,
          }),
        });
        const data = (await res.json()) as VerifyMfaResponse & { error?: string };
        if (!res.ok || data.error) {
          setError(data.error ?? 'MFA verification failed.');
          return null;
        }

        writeStorage(ACCESS_TOKEN_KEY, data.accessToken);
        writeStorage(REFRESH_TOKEN_KEY, data.refreshToken);
        if (data.deviceToken) {
          writeStorage(DEVICE_TOKEN_KEY, data.deviceToken);
        }
        markActivity();
        setRequiresMfa(false);
        setLoginSessionToken('');
        return data;
      } finally {
        setIsLoading(false);
      }
    },
    [loginSessionToken, markActivity]
  );

  const refresh = useCallback(async (): Promise<boolean> => {
    const refreshToken = readStorage(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    const res = await fetch('/api/v1/admin/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
    if (!res.ok || !data.accessToken || !data.refreshToken) {
      clearSession();
      return false;
    }

    writeStorage(ACCESS_TOKEN_KEY, data.accessToken);
    writeStorage(REFRESH_TOKEN_KEY, data.refreshToken);
    markActivity();
    return true;
  }, [clearSession, markActivity]);

  const logout = useCallback(async (): Promise<void> => {
    await fetch('/api/v1/admin/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: readStorage(ACCESS_TOKEN_KEY),
        refreshToken: readStorage(REFRESH_TOKEN_KEY),
        deviceToken: readStorage(DEVICE_TOKEN_KEY),
      }),
    }).catch(() => undefined);

    clearSession();
  }, [clearSession]);

  return {
    isLoading,
    error,
    accessToken,
    requiresMfa,
    loginSessionToken,
    login,
    verifyMfa,
    refresh,
    logout,
    clearSession,
    setupRequired,
  };
}

export default useAdminAuth;
