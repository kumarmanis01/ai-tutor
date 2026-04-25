/**
 * FILE OBJECTIVE:
 * - Manage per-session doubt attempt counters and rolling history in Redis.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/redis/doubtEscalation.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-23T00:00:00Z | copilot | fix(strict): guard getRedis() null and return safe defaults
 */

import { createHash } from 'crypto';
import { getRedis } from '@/lib/redis';

// Key: session:{sessionId}:doubt_attempts:{doubtHash}  TTL: 3600s
// Key: session:{sessionId}:doubt_history:{doubtHash}   TTL: 3600s (JSON array, last 3)
const TTL = 3600;

export type DoubtAttemptEntry = {
  turnId: string;
  aiResponse: string;
};

export function makeDoubtHash(conceptId: string, studentMessage: string): string {
  return createHash('sha256').update(`${conceptId}:${studentMessage}`).digest('hex').slice(0, 8);
}

function counterKey(sessionId: string, doubtHash: string): string {
  return `session:${sessionId}:doubt_attempts:${doubtHash}`;
}

function historyKey(sessionId: string, doubtHash: string): string {
  return `session:${sessionId}:doubt_history:${doubtHash}`;
}

/**
 * Increment the doubt attempt counter for this (sessionId, doubtHash) pair,
 * append the new entry to the rolling history (capped at 3), and return the
 * updated count and history.
 *
 * Never throws -- returns { count: 0, history: [] } on Redis error.
 */
export async function trackDoubtAttempt(
  sessionId: string,
  doubtHash: string,
  entry: DoubtAttemptEntry
): Promise<{ count: number; history: DoubtAttemptEntry[] }> {
  try {
    const redis = getRedis();
    if (!redis) return { count: 0, history: [] };
    const cKey = counterKey(sessionId, doubtHash);
    const hKey = historyKey(sessionId, doubtHash);

    // Increment counter
    const count = await redis.incr(cKey);
    await redis.expire(cKey, TTL);

    // Read, append, cap history at 3 entries
    const raw = await redis.get(hKey);
    let history: DoubtAttemptEntry[] = [];
    if (raw) {
      try {
        history = JSON.parse(raw);
      } catch {
        history = [];
      }
    }
    history.push(entry);
    if (history.length > 3) history = history.slice(-3);
    await redis.set(hKey, JSON.stringify(history), 'EX', TTL);

    return { count, history };
  } catch {
    return { count: 0, history: [] };
  }
}

/**
 * Reset the doubt counter and history for this (sessionId, doubtHash).
 * Call after escalation is created or when the student resolves the doubt.
 * Never throws.
 */
export async function resetDoubtCounter(sessionId: string, doubtHash: string): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.del(counterKey(sessionId, doubtHash));
    await redis.del(historyKey(sessionId, doubtHash));
  } catch {
    // never throw
  }
}
