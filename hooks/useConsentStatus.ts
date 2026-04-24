/**
 * FILE OBJECTIVE:
 * - Poll GET /api/v1/consent/status every 15 seconds while Explore Mode is active.
 *   Returns the latest consent status, expiry, masked contact, and reminder count.
 *   Falls back to polling if any error occurs (no WebSocket in this implementation).
 *
 * LINKED UNIT TEST:
 * - tests/unit/hooks/useConsentStatus.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

export type ConsentStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED'

export interface ConsentStatusResult {
  status: ConsentStatus | null
  expiresAt: string | null
  sentTo: string | null
  channel: string | null
  reminderCount: number
  error: string | null
  loading: boolean
}

const POLL_INTERVAL_MS = 15_000

export function useConsentStatus(consentToken: string | null): ConsentStatusResult {
  const [result, setResult] = useState<ConsentStatusResult>({
    status: null,
    expiresAt: null,
    sentTo: null,
    channel: null,
    reminderCount: 0,
    error: null,
    loading: false,
  })

  const poll = useCallback(async () => {
    if (!consentToken) return
    setResult((prev) => ({ ...prev, loading: true }))
    try {
      const res = await fetch(`/api/v1/consent/status?consent_token=${encodeURIComponent(consentToken)}`)
      if (!res.ok) {
        setResult((prev) => ({ ...prev, loading: false, error: `Request failed: ${res.status}` }))
        return
      }
      const data: { status: ConsentStatus; expiresAt: string; sentTo: string; channel: string; reminderCount: number } = await res.json()
      setResult({ status: data.status, expiresAt: data.expiresAt, sentTo: data.sentTo, channel: data.channel, reminderCount: data.reminderCount, error: null, loading: false })
    } catch {
      setResult((prev) => ({ ...prev, loading: false, error: 'Network error' }))
    }
  }, [consentToken])

  useEffect(() => {
    if (!consentToken) return
    void poll()
    const interval = setInterval(() => { void poll() }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [consentToken, poll])

  return result
}
