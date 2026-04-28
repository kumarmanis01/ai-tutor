import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Generate (or regenerate) a week-based LearningPlan for a student + subject.
 *
 * Ordering strategy: weak-first -- lowest masteryScore first, then curriculum
 * order (chapter.order → topic.order → concept insert order) for ties.
 * This surfaces the most urgent gaps at the start of the plan.
 *
 * Distribution: weeklyGoal concepts per week (default 5 = one per study day).
 * orderInWeek is 0-based within each week.
 *
 * Upserts the LearningPlan row, deletes all old LearningPlanItems, then
 * bulk-creates new ones.
 *
 * Never throws -- logs error and returns null on failure.
 *
 * @returns planId string on success, null on failure
 */
export async function generateLearningPlan(
  studentId: string,
  subjectId: string,
  options?: { examDate?: Date; weeklyGoal?: number }
): Promise<string | null> {
  try {
    const weeklyGoal = options?.weeklyGoal ?? 5;

    // 1. Load all concepts for the subject in curriculum order. Include
    // topic metadata so we can optionally bias ordering based on a
    // parent-submitted `topicFocusRequest` (F-PAR-002 AC-03).
    const concepts = await prisma.concept.findMany({
      where: { subjectId },
      select: {
        id: true,
        name: true,
        topic: {
          select: {
            id: true,
            name: true,
            order: true,
            chapter: {
              select: { order: true },
            },
          },
        },
      },
      orderBy: [{ topic: { chapter: { order: 'asc' } } }, { topic: { order: 'asc' } }],
    });
    type ConceptRow = {
      id: string;
      topic?: {
        name?: string | null;
        order?: number | null;
        chapter?: { order?: number | null };
      } | null;
    };

    if (concepts.length === 0) {
      logger.warn('[generateLearningPlan] no concepts found', { studentId, subjectId });
      return null;
    }

    const conceptIds = (concepts as ConceptRow[]).map((c: ConceptRow) => c.id);

    // 2. Load mastery scores for this student
    const states = await prisma.studentConceptState.findMany({
      where: { studentId, conceptId: { in: conceptIds } },
      select: { conceptId: true, masteryScore: true },
    });
    type StateRow = { conceptId: string; masteryScore: number };
    const masteryByConcept = new Map<string, number>(
      (states as StateRow[]).map((s: StateRow) => [s.conceptId, s.masteryScore] as [string, number])
    );

    // 3. Sort: lowest mastery first, then curriculum order. If a parent has
    // provided a `topicFocusRequest`, boost concepts whose topic name matches
    // the request to the front (without dropping the weakest-first principle).
    // parentChildControl may not exist in some test mocks; guard access
    let topicFocus: string | null = null;
    try {
      const pcc = (prisma as any).parentChildControl;
      if (pcc && typeof pcc.findFirst === 'function') {
        const control = await pcc.findFirst({
          where: { studentId },
          select: { topicFocusRequest: true },
          orderBy: { updatedAt: 'desc' },
        });
        topicFocus = (control?.topicFocusRequest || '').trim().toLowerCase() || null;
      }
    } catch {
      // Best-effort: if lookup fails, ignore topic focus so plan generation remains robust
      topicFocus = null;
    }

    const sorted = [...concepts].sort((a, b) => {
      const ma = masteryByConcept.get(a.id) ?? 0;
      const mb = masteryByConcept.get(b.id) ?? 0;

      // If one concept belongs to the parent's requested topic and the other
      // does not, prefer the requested-topic concept.
      if (topicFocus) {
        const aIsPreferred = !!(a.topic?.name && a.topic.name.toLowerCase().includes(topicFocus));
        const bIsPreferred = !!(b.topic?.name && b.topic.name.toLowerCase().includes(topicFocus));
        if (aIsPreferred && !bIsPreferred) return -1;
        if (bIsPreferred && !aIsPreferred) return 1;
      }

      if (ma !== mb) return ma - mb; // ascending: weakest first
      // Tie-break: curriculum order (chapter.order → topic.order)
      const ca = a.topic?.chapter?.order ?? 0;
      const cb = b.topic?.chapter?.order ?? 0;
      if (ca !== cb) return ca - cb;
      const ta = a.topic?.order ?? 0;
      const tb = b.topic?.order ?? 0;
      return ta - tb;
    });

    // 4. Upsert LearningPlan
    const now = new Date();
    const existingPlan = await prisma.learningPlan.findUnique({
      where: { studentId_subjectId: { studentId, subjectId } },
      select: { id: true },
    });

    let planId: string;
    if (existingPlan) {
      // Delete old items before regenerating
      await prisma.learningPlanItem.deleteMany({ where: { planId: existingPlan.id } });
      await prisma.learningPlan.update({
        where: { id: existingPlan.id },
        data: {
          weeklyGoal,
          generatedAt: now,
          updatedAt: now,
          ...(options?.examDate !== undefined ? { examDate: options.examDate } : {}),
        },
      });
      planId = existingPlan.id;
    } else {
      const created = await prisma.learningPlan.create({
        data: {
          studentId,
          subjectId,
          weeklyGoal,
          generatedAt: now,
          updatedAt: now,
          examDate: options?.examDate ?? null,
        },
      });
      planId = created.id;
    }

    // 5. Assign weekNumber and orderInWeek, then bulk-create items
    const itemsData = sorted.map((concept, idx) => {
      const weekNumber = Math.floor(idx / weeklyGoal) + 1;
      const orderInWeek = idx % weeklyGoal;
      return {
        planId,
        conceptId: concept.id,
        weekNumber,
        orderInWeek,
        // status defaults to UPCOMING via schema default
      };
    });

    await prisma.learningPlanItem.createMany({ data: itemsData });

    logger.info('[generateLearningPlan] plan generated', {
      studentId,
      subjectId,
      planId,
      itemCount: itemsData.length,
      weekCount: Math.ceil(itemsData.length / weeklyGoal),
    });

    return planId;
  } catch (err) {
    logger.error('[generateLearningPlan] failed', {
      studentId,
      subjectId,
      error: String((err as any)?.message ?? err),
    });
    return null;
  }
}
