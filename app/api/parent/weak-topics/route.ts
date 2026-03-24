export const dynamic = 'force-dynamic';

/**
 * FILE OBJECTIVE:
 * - Returns up to 5 weak topics for a linked student.
 * - A topic is "weak" when mastery < 0.4 AND practiceCount > 5 -- meaning the
 *   student has practised the topic enough for the low mastery to be meaningful,
 *   not just noise from a first attempt.
 * - Results are sorted by mastery ascending so the most-struggling topics appear
 *   first.
 *
 * TABLE USED: StudentTopicProgress only. No curriculum joins.
 *
 * QUERY PLAN:
 * - The existing @@index([studentId, mastery]) on StudentTopicProgress is a
 *   composite B-tree index ordered (studentId ASC, mastery ASC).
 *
 *   Postgres execution for this query:
 *
 *     Index Range Scan on "StudentTopicProgress_studentId_mastery_idx"
 *       → equality probe on studentId = $1
 *       → range scan on mastery < 0.4   (index is already sorted; scan stops at 0.4)
 *       → heap fetch for practiceCount filter (not in index)
 *       → LIMIT 5
 *
 *   Because mastery is the second column of the index and the rows are already
 *   ordered (studentId, mastery ASC), Postgres can:
 *     1. Jump directly to the first row for this student via the equality probe.
 *     2. Walk forward in index order, stopping as soon as mastery >= 0.4.
 *     3. Apply the practiceCount > 5 filter as a heap-fetch predicate.
 *     4. Stop after collecting 5 rows (LIMIT pushdown).
 *
 *   This never reads rows for other students and never scans beyond mastery 0.4.
 *   For a student with 500 topic rows, only the low-mastery subset is touched.
 *
 * RECOMMENDED INDEX (already present):
 *   @@index([studentId, mastery])   ← in schema.prisma line 826
 *
 *   If practiceCount filters become very selective in future (e.g. the threshold
 *   rises and most weak topics are eliminated), a covering index could be added:
 *
 *     @@index([studentId, mastery, practiceCount])
 *
 *   That would let Postgres evaluate the practiceCount predicate from the index
 *   page alone, avoiding heap fetches entirely for eliminated rows.
 *   Not needed at the current threshold -- heap fetches for ≤ 5 rows are trivial.
 *
 * SECURITY:
 * - Caller must be authenticated.
 * - parentId-studentId link is verified before any student data is read.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Parent Progress Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import type { AppSession } from '@/lib/types/auth';

const CLASS_NAME = 'ParentWeakTopicsAPI';

// ── Thresholds ────────────────────────────────────────────────────────────────

/**
 * A topic is only flagged as weak once the student has practised it enough
 * for the mastery score to be statistically meaningful. Below this count the
 * low mastery may simply reflect a first attempt, not a persistent gap.
 */
const MIN_PRACTICE_COUNT = 5;

/** Mastery scores at or above this value are not considered weak. */
const WEAK_MASTERY_CEILING = 0.4;

/** Maximum weak topics returned -- keeps the parent view focused. */
const RESULT_LIMIT = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeakTopic {
  topicId: string;
  mastery: number;
  practiceCount: number;
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/parent/weak-topics?studentId=<id>
 *
 * Response shape:
 * WeakTopic[]   -- ordered by mastery ascending, max 5 items.
 *
 * Returns an empty array when no weak topics exist (never null).
 */
export async function GET(req: NextRequest) {
  const start = Date.now();
  const METHOD_NAME = 'GET';

  try {
    // ── 1. Auth ───────────────────────────────────────────────────────────────
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const parentId = session.user.id;

    // ── 2. Input validation ───────────────────────────────────────────────────
    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    // ── 3. Parent-student link guard ──────────────────────────────────────────
    // Resolved via the @@unique([parentId, studentId]) key -- O(1) index lookup.
    // No student data is read until this passes.
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { status: true },
    });
    if (!link || link.status === 'revoked') {
      return NextResponse.json({ error: 'Student not linked' }, { status: 403 });
    }

    // ── 4. Weak-topic query ───────────────────────────────────────────────────
    //
    // SQL equivalent:
    //
    //   SELECT topicId, mastery, practiceCount
    //   FROM   "StudentTopicProgress"
    //   WHERE  studentId     = $1              -- index equality probe
    //     AND  mastery       < $2              -- 0.4, index range scan
    //     AND  practiceCount > $3              -- 5, heap predicate
    //   ORDER  BY mastery ASC                  -- index already sorted this way
    //   LIMIT  5;
    //
    // Prisma maps `lt` → `<` and `gt` → `>`, matching the above exactly.
    // `select` restricts the projection so no unrequested columns are fetched.
    const rows = await prisma.studentTopicProgress.findMany({
      where: {
        studentId,
        mastery:       { lt: WEAK_MASTERY_CEILING },
        practiceCount: { gt: MIN_PRACTICE_COUNT },
      },
      orderBy: { mastery: 'asc' },
      take: RESULT_LIMIT,
      select: {
        topicId:       true,
        mastery:       true,
        practiceCount: true,
      },
    });

    // ── 5. Shape response ─────────────────────────────────────────────────────
    const weakTopics: WeakTopic[] = rows.map((r) => ({
      topicId:       r.topicId,
      mastery:       r.mastery,
      practiceCount: r.practiceCount,
    }));

    const response = NextResponse.json(weakTopics);

    logger.info('Parent weak topics fetched', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      parentId,
      studentId,
      count: weakTopics.length,
    });

    logger.logAPI(req, response, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
    return response;
  } catch (error) {
    logger.error('Failed to fetch parent weak topics', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      error,
    });
    return NextResponse.json(
      { error: formatErrorForResponse(error) },
      { status: 500 },
    );
  }
}
