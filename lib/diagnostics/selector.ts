import { prisma } from '@/lib/prisma';
import { DiagnosticSessionPayload } from '@/lib/diagnostics/sessionStore';
import { eapEstimate, fisherInfo } from '@/lib/irt/irt';

/**
 * Simple adaptive selector:
 * - Computes current theta via EAP from administered items
 * - Prefers candidates from topics not yet covered
 * - Picks candidate with max Fisher information at current theta
 * - Uses defaults for missing IRT params
 */

type QuestionRow = {
  id: string;
  irt_a?: number | null;
  irt_b: number | null;
  irt_c?: number | null;
  topicId: string | null;
  prompt?: string | null;
  choices?: any | null;
  difficulty?: string | null;
};

function defaultA() {
  return 1.0;
}

function defaultC() {
  return 0.2;
}

function defaultBFromDifficulty(difficulty?: string | null) {
  if (!difficulty) return 0;
  const d = difficulty.toLowerCase?.();
  if (d.includes('easy')) return -1.0;
  if (d.includes('hard')) return 1.0;
  return 0;
}

/**
 * Compute current theta estimate (EAP) from the session's administered items/responses.
 * Returns { theta, se } -- se=1 when no items have been administered yet.
 */
export async function computeSessionTheta(
  session: DiagnosticSessionPayload,
): Promise<{ theta: number; se: number }> {
  const administered = session.administered ?? [];
  const administeredIds = administered.map((a) => a.questionId).filter(Boolean);
  if (administeredIds.length === 0) return { theta: 0, se: 1 };

  const adminRows: QuestionRow[] = await prisma.question.findMany({
    where: { id: { in: administeredIds } },
    select: { id: true, irt_a: true, irt_b: true, irt_c: true, topicId: true, prompt: true, choices: true, difficulty: true },
  });

  const items = adminRows.map((r) => ({
    a: r.irt_a ?? defaultA(),
    b: r.irt_b ?? defaultBFromDifficulty(r.difficulty),
    c: r.irt_c ?? defaultC(),
  }));
  const responses = administeredIds.map(
    (id) => (administered.find((a) => a.questionId === id)?.correct ? 1 : 0),
  );
  return eapEstimate(items, responses);
}

export async function selectNextQuestion(session: DiagnosticSessionPayload) {
  const administered = session.administered ?? [];
  const administeredIds = administered.map((a) => a.questionId).filter(Boolean);

  // Reuse computeSessionTheta to avoid duplicating EAP logic
  const { theta } = await computeSessionTheta(session);

  // Remaining candidate ids
  const remaining = (session.candidateQuestionIds ?? []).filter((id) => !administeredIds.includes(id));
  if (remaining.length === 0) return null;

  // Fetch both candidate rows and administered rows (for topic balancing) in parallel
  const [candidateRows, administeredRows] = (await Promise.all([
    prisma.question.findMany({
      where: { id: { in: remaining } },
      select: { id: true, irt_a: true, irt_b: true, irt_c: true, topicId: true, prompt: true, choices: true, difficulty: true },
    }),
    administeredIds.length > 0
      ? prisma.question.findMany({
          where: { id: { in: administeredIds } },
          select: { id: true, topicId: true },
        })
      : Promise.resolve([] as Pick<QuestionRow, 'id' | 'topicId'>[]),
  ])) as [QuestionRow[], Pick<QuestionRow, 'id' | 'topicId'>[]];

  // Topic balancing: prefer questions from topics not yet administered
  const administeredTopics = new Set((administeredRows as Pick<QuestionRow, 'topicId'>[])
    .map((r) => r.topicId)
    .filter((tid): tid is string => typeof tid === 'string' && tid.length > 0));
  const notSeen = (candidateRows as QuestionRow[]).filter((c: QuestionRow) => !administeredTopics.has(c.topicId ?? ''));

  const pool = notSeen.length > 0 ? notSeen : candidateRows;

  // Compute fisher info for each candidate
  let best: { row: QuestionRow; info: number } | null = null;
  for (const r of pool) {
    const a = r.irt_a ?? defaultA();
    const b = r.irt_b ?? defaultBFromDifficulty(r.difficulty);
    const c = r.irt_c ?? defaultC();
    const info = fisherInfo(theta, a, b, c);
    if (!best || info > best.info) best = { row: r, info };
  }

  if (!best) return null;

  // Return question shape used by client
  return {
    id: best.row.id,
    prompt: best.row.prompt ?? '',
    options: (best.row.choices as any) ?? [],
    topicId: best.row.topicId ?? null,
    difficulty: best.row.difficulty ?? null,
  } as const;
}

const DiagnosticsSelector = { selectNextQuestion };
export default DiagnosticsSelector;
