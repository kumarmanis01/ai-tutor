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
  irt_b: number | null;
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

export async function selectNextQuestion(session: DiagnosticSessionPayload) {
  const administered = session.administered ?? [];
  const administeredIds = administered.map((a) => a.questionId).filter(Boolean);

  // Fetch IRT params for administered items (if any)
  const adminRows: QuestionRow[] =
    administeredIds.length > 0
      ? await prisma.question.findMany({
          where: { id: { in: administeredIds } },
          select: { id: true, irt_b: true, topicId: true, prompt: true, choices: true, difficulty: true },
        })
      : [];

  const items = adminRows.map((r, i) => ({ a: defaultA(), b: r.irt_b ?? defaultBFromDifficulty(r.difficulty), c: defaultC() }));
  const responses = administeredIds.map((id) => (administered.find((a) => a.questionId === id)?.correct ? 1 : 0));

  // Compute theta via EAP (robust for small item counts)
  const { theta } = items.length > 0 ? eapEstimate(items, responses) : { theta: 0 };

  // Remaining candidate ids
  const remaining = (session.candidateQuestionIds ?? []).filter((id) => !administeredIds.includes(id));
  if (remaining.length === 0) return null;

  const candidateRows = await prisma.question.findMany({
    where: { id: { in: remaining } },
    select: { id: true, irt_b: true, topicId: true, prompt: true, choices: true, difficulty: true },
  });

  // Topic balancing: prefer questions from topics not yet administered
  const administeredTopics = new Set(adminRows.map((r) => r.topicId).filter(Boolean));
  const notSeen = candidateRows.filter((c) => !administeredTopics.has(c.topicId ?? ''));

  const pool = notSeen.length > 0 ? notSeen : candidateRows;

  // Compute fisher info for each candidate
  let best: { row: QuestionRow; info: number } | null = null;
  for (const r of pool) {
    const a = defaultA();
    const b = r.irt_b ?? defaultBFromDifficulty(r.difficulty);
    const c = defaultC();
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

export default { selectNextQuestion };
