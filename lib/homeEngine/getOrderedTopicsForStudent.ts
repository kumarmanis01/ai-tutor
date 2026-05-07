/**
 * FILE OBJECTIVE:
 * Shared curriculum query -- returns the full ordered topic list for a student's
 * board + grade + subject context. Used by getNextAction() P5 and the test
 * script so both work from an identical, student-scoped dataset.
 *
 * The query is the single source of truth for "what topics is this student
 * expected to work through, and in what order?" -- any caller that needs the
 * curriculum sequence must go through this function.
 *
 * EDIT LOG:
 * - 2026-02-23 | claude | extracted from p5_nextNewTopic for shared use
 * - 2026-05-07T00:00:00Z | copilot | fix: match subjects by slug OR name (OR filter) because
 *                               onboarding stores lowercase slugs (e.g. 'mathematics') while
 *                               SubjectDef.name may be title-cased ('Mathematics'); previously
 *                               the name-only filter returned empty topics, causing P5 to return
 *                               all_topics_complete and the dashboard to show plan_loading
 */

import { prisma } from '@/lib/prisma';

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
 * Returns [] when the student's profile is missing board or grade -- the caller
 * should treat this as "curriculum context unknown, no action possible".
 */
export async function getOrderedTopicsForStudent(studentId: string) {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { board: true, grade: true, subjects: true },
  });

  const grade = user?.grade ? parseInt(String(user.grade), 10) : NaN;
  if (!user?.board || isNaN(grade)) return [];

  // Subjects are stored as lowercase slugs (e.g. 'mathematics') from the
  // onboarding route, but SubjectDef.name may be title-cased ('Mathematics').
  // Match by either name OR slug so the filter works regardless of casing or
  // slug/display-name mismatch -- mirrors the same OR pattern used on the dashboard.
  const subjectSlugs = Array.isArray(user.subjects)
    ? (user.subjects as string[]).filter(Boolean)
    : []
  const subjectNameFilter =
    subjectSlugs.length > 0
      ? { OR: [{ name: { in: subjectSlugs } }, { slug: { in: subjectSlugs } }] }
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

// Derive the exported `OrderedTopic` type AFTER the function to avoid a
// circular type reference where the alias would refer to the function's
// return type while the function's signature referenced the alias.
export type OrderedTopic = Awaited<ReturnType<typeof getOrderedTopicsForStudent>>[number];
