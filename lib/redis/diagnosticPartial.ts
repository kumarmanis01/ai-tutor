import { getRedis } from '@/lib/redis';

// Key pattern: diagnostic:partial:{studentId}:{subjectId}
// TTL: 86400s (24 hours)
// Redis failure NEVER throws -- all ops wrapped in try/catch, return null on miss/error

const TTL_SECONDS = 86400;

export type DiagnosticPartialAnswer = {
  questionId: string;
  selectedOption: string;
};

export type DiagnosticPartialState = {
  answers: DiagnosticPartialAnswer[];
  currentIndex: number;
};

function key(studentId: string, subjectId: string): string {
  return `diagnostic:partial:${studentId}:${subjectId}`;
}

export async function getPartialDiagnostic(
  studentId: string,
  subjectId: string
): Promise<DiagnosticPartialState | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    const raw = await redis.get(key(studentId, subjectId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as DiagnosticPartialState).answers) ||
      typeof (parsed as DiagnosticPartialState).currentIndex !== 'number'
    ) {
      return null;
    }
    return parsed as DiagnosticPartialState;
  } catch {
    return null;
  }
}

export async function savePartialDiagnostic(
  studentId: string,
  subjectId: string,
  state: DiagnosticPartialState
): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(key(studentId, subjectId), JSON.stringify(state), 'EX', TTL_SECONDS);
  } catch {
    // never throw
  }
}

export async function clearPartialDiagnostic(studentId: string, subjectId: string): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.del(key(studentId, subjectId));
  } catch {
    // never throw
  }
}
