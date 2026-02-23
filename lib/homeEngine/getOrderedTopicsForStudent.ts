/**
 * FILE OBJECTIVE:
 * Shared curriculum query — returns the full ordered topic list for a student's
 * board + grade + subject context. Used by getNextAction() P5 and the test
 * script so both work from an identical, student-scoped dataset.
 *
 * The query is the single source of truth for "what topics is this student
 * expected to work through, and in what order?" — any caller that needs the
 * curriculum sequence must go through this function.
 *
 * EDIT LOG:
 * - 2026-02-23 | claude | extracted from p5_nextNewTopic for shared use
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/** Full topic shape returned — includes the chapter → subject → class → board chain. */
export type OrderedTopic = Prisma.TopicDefGetPayload<{
  include: {
    chapter: {
      include: {
        subject: {
          include: {
            class: { include: { board: true } };
          };
        };
      };
    };
  };
}>;

/**
 * Returns all active TopicDefs visible to the student's curriculum context,
 * ordered by chapter.order ASC, topic.order ASC.
 *
 * Filters applied (identical to engine P5 rule):
 *   - lifecycle = active at every level: topicDef, chapter, subject, class, board
 *   - board slug matched case-insensitively to student's board
 *   - grade matched to student's grade
 *   - subject names filtered when the student has enrolled subjects set
 *
 * Returns [] when the student's profile is missing board or grade — the caller
 * should treat this as "curriculum context unknown, no action possible".
 */
export async function getOrderedTopicsForStudent(studentId: string): Promise<OrderedTopic[]> {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { board: true, grade: true, subjects: true },
  });

  const grade = user?.grade ? parseInt(String(user.grade), 10) : NaN;
  if (!user?.board || isNaN(grade)) return [];

  const subjectNameFilter =
    Array.isArray(user.subjects) && (user.subjects as string[]).length > 0
      ? { name: { in: user.subjects as string[] } }
      : {};

  return prisma.topicDef.findMany({
    where: {
      lifecycle: 'active',
      chapter: {
        lifecycle: 'active',
        subject: {
          lifecycle: 'active',
          ...subjectNameFilter,
          class: {
            lifecycle: 'active',
            grade,
            board: {
              lifecycle: 'active',
              slug: { equals: user.board, mode: 'insensitive' },
            },
          },
        },
      },
    },
    orderBy: [
      { chapter: { order: 'asc' } },
      { order: 'asc' },
    ],
    include: {
      chapter: {
        include: {
          subject: {
            include: {
              class: { include: { board: true } },
            },
          },
        },
      },
    },
  });
}
