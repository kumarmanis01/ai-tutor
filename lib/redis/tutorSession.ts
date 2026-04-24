/**
 * FILE OBJECTIVE:
 * - Lightweight helper for storing per-tutor-session state in Redis.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/redis/tutorSession.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-23T00:00:00Z | copilot | fix(strict): guard getRedis() before Redis ops
 */

import { getRedis } from '@/lib/redis'

// Key pattern: session:tutor:{sessionId}   TTL: 86400s (refreshed on every write)
// Redis failure NEVER throws -- all ops wrapped in try/catch, return null on miss/error

export type RedisSessionState = {
  sessionId: string
  stage?: string
  hintsRemaining?: number
  lastTurnNumber?: number
  lastTurnCompleted?: boolean
  // Forward-compatible fields (safe to ignore for now)
  [key: string]: unknown
}

const KEY_PREFIX = 'session:tutor:'
const TTL_SECONDS = 86400

function key(sessionId: string) {
  return `${KEY_PREFIX}${sessionId}`
}

function safeParse(raw: string | null, sessionId: string): RedisSessionState | null {
  if (!raw) return null
  try {
    const parsed: any = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.sessionId !== 'string' || parsed.sessionId !== sessionId) return null
    return parsed as RedisSessionState
  } catch {
    return null
  }
}

export async function getTutorSession(sessionId: string): Promise<RedisSessionState | null> {
  try {
    const redis = getRedis()
    if (!redis) return null
    const raw = await redis.get(key(sessionId))
    return safeParse(raw, sessionId)
  } catch {
    return null
  }
}

export async function setTutorSession(sessionId: string, state: RedisSessionState): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    const payload: RedisSessionState = { ...state, sessionId }
    await redis.set(key(sessionId), JSON.stringify(payload), 'EX', TTL_SECONDS)
  } catch {
    // never throw
  }
}

export async function updateTutorSession(sessionId: string, partial: Partial<RedisSessionState>): Promise<void> {
  try {
    const existing = await getTutorSession(sessionId)
    const next: RedisSessionState = {
      ...(existing ?? { sessionId }),
      ...partial,
      sessionId,
    }
    await setTutorSession(sessionId, next)
  } catch {
    // never throw
  }
}

export async function deleteTutorSession(sessionId: string): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    await redis.del(key(sessionId))
  } catch {
    // never throw
  }
}

export async function markTurnStarted(sessionId: string): Promise<void> {
  await updateTutorSession(sessionId, { lastTurnCompleted: false })
}

export async function markTurnCompleted(sessionId: string): Promise<void> {
  await updateTutorSession(sessionId, { lastTurnCompleted: true })
}

export async function hasIncompleteTurn(sessionId: string): Promise<boolean> {
  try {
    const state = await getTutorSession(sessionId)
    if (!state) return false
    return state.lastTurnCompleted === false
  } catch {
    return false
  }
}

