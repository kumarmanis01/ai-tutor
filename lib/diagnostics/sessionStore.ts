import { getRedis } from '@/lib/redis';

const TTL_SECONDS = 48 * 60 * 60; // 48 hours

export type DiagnosticSessionPayload = {
  sessionId: string;
  userId: string;
  subjectId: string;
  subjectName?: string;
  boardSlug?: string;
  grade?: number | string;
  candidateQuestionIds: string[]; // preselected pool (IDs)
  administered: Array<{
    questionId: string;
    correct?: boolean;
    selectedOption?: string;
    timeSpentMs?: number;
    timestamp?: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

function key(sessionId: string) {
  return `diagnostic:session:${sessionId}`;
}

export async function createSession(sessionId: string, payload: DiagnosticSessionPayload) {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(key(sessionId), JSON.stringify(payload), 'EX', TTL_SECONDS);
  } catch {
    // never throw
  }
}

export async function getSession(sessionId: string): Promise<DiagnosticSessionPayload | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    const raw = await redis.get(key(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as DiagnosticSessionPayload;
  } catch {
    return null;
  }
}

export async function updateSession(sessionId: string, patch: Partial<DiagnosticSessionPayload>) {
  try {
    const redis = getRedis();
    if (!redis) return;
    const cur = await getSession(sessionId);
    const updated = { ...(cur ?? {}), ...patch, updatedAt: new Date().toISOString() } as DiagnosticSessionPayload;
    await redis.set(key(sessionId), JSON.stringify(updated), 'EX', TTL_SECONDS);
    return updated;
  } catch {
    return null;
  }
}

export async function deleteSession(sessionId: string) {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.del(key(sessionId));
  } catch {
    // ignore
  }
}
