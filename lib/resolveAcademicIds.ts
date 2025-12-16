import { prisma } from '@/lib/prisma'

type ResolveResult =
  | { success: true; subjectId: string; boardSlug?: string }
  | { success: false; reason: 'not_found' | 'ambiguous' | 'invalid_input' }

export async function resolveSubjectId(input: { board?: string; grade?: number; subject?: string; subjectId?: string }): Promise<ResolveResult> {
  const { board, grade, subject, subjectId } = input;

  if (subjectId) {
    const s = await prisma.subjectDef.findUnique({ where: { id: subjectId } });
    if (s) return { success: true, subjectId: s.id };
    return { success: false, reason: 'not_found' };
  }

  if (!board || !grade || !subject) return { success: false, reason: 'invalid_input' };

  // board may be slug or id; try slug first then id
  const boardRow = await prisma.board.findFirst({ where: { OR: [{ slug: board }, { id: board }] } });
  if (!boardRow) return { success: false, reason: 'not_found' };

  const cls = await prisma.classLevel.findFirst({ where: { boardId: boardRow.id, grade } });
  if (!cls) return { success: false, reason: 'not_found' };

  // try to match subject slug then name (case-insensitive)
  const candidates = await prisma.subjectDef.findMany({ where: { classId: cls.id, OR: [{ slug: subject }, { name: { equals: subject, mode: 'insensitive' } }] } });
  if (candidates.length === 1) return { success: true, subjectId: candidates[0].id, boardSlug: boardRow.slug };
  if (candidates.length > 1) return { success: false, reason: 'ambiguous' };

  return { success: false, reason: 'not_found' };
}
