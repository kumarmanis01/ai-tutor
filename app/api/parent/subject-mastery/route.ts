export const dynamic = 'force-dynamic';

/**
 * FILE OBJECTIVE:
 * - Returns per-subject average mastery for a linked student.
 * - Groups StudentTopicMastery rows by the denormalized `subject` field
 *   and computes AVG(accuracy) + topic count per group.
 *
 * ── TABLE CHOICE: StudentTopicMastery, NOT StudentTopicProgress ─────────────
 *
 * The task originally referenced StudentTopicProgress for this query.
 * After codebase analysis, StudentTopicMastery is the correct table because:
 *
 * 1. StudentTopicProgress has NO `subject` field.
 *    Grouping by subject from StudentTopicProgress requires a 3-level join:
 *      StudentTopicProgress → TopicDef → ChapterDef → SubjectDef
 *    This join is expensive, not indexed at the join boundaries relevant here,
 *    and unnecessary given the dual-write pattern already in place.
 *
 * 2. StudentTopicMastery stores `subject` (and `chapter`) as denormalized
 *    string columns, written atomically alongside StudentTopicProgress in
 *    lib/learning/updateTopicProgress.ts. Both tables are always in sync.
 *
 * 3. StudentTopicMastery has @@index([subject, chapter]) designed for
 *    exactly this kind of subject-level grouping query.
 *
 * 4. StudentTopicMastery.accuracy is the authoritative per-topic accuracy
 *    score and is directly comparable to StudentTopicProgress.mastery
 *    (they track the same learning signal from different angles: mastery is
 *    the weighted composite; accuracy is the raw question-answer rate).
 *    For a per-subject summary shown to parents, accuracy is the right signal.
 *
 * ── QUERY PLAN ───────────────────────────────────────────────────────────────
 *
 * SQL equivalent:
 *
 *   SELECT
 *     subject,
 *     AVG(accuracy)           AS avgAccuracy,
 *     COUNT(*)                AS topicCount
 *   FROM  "StudentTopicMastery"
 *   WHERE "studentId" = $1
 *   GROUP BY subject
 *   ORDER BY subject ASC;
 *
 * Execution path (Postgres):
 *
 *   Index Scan on "StudentTopicMastery_studentId_masteryLevel_idx"
 *     → equality probe: studentId = $1       (index hit — leading column)
 *     → heap fetch for every matched row
 *     → GROUP BY subject + AVG(accuracy)     (in-memory hash aggregate)
 *     → ORDER BY subject ASC                 (sort on aggregate output)
 *
 * The studentId probe narrows the scan to this student's rows only.
 * GROUP BY subject then runs in memory over those rows — bounded by how
 * many topics the student has attempted (typically tens to low hundreds).
 *
 * Recommended index for optimal performance (not yet in schema):
 *
 *   @@index([studentId, subject])
 *
 *   This would let Postgres:
 *     - Probe studentId on the index.
 *     - Scan (studentId, subject) pairs in order, eliminating the sort step.
 *     - Fetch heap pages only for matched rows.
 *   Add when the table grows beyond ~1 000 rows per student or EXPLAIN ANALYZE
 *   shows a significant sort/hash-aggregate cost.
 *
 * SECURITY:
 * - Caller must be authenticated.
 * - parentId–studentId link verified (O(1) unique-index lookup) before any
 *   student data is read.
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

const CLASS_NAME = 'ParentSubjectMasteryAPI';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubjectMastery {
  subject: string;    // e.g. "Mathematics"
  avgAccuracy: number; // 0–1, rounded to 4 d.p.
  topicCount: number;  // how many distinct topics contribute to this average
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/parent/subject-mastery?studentId=<id>
 *
 * Response shape:
 * SubjectMastery[]  — one entry per subject the student has attempted,
 *                     ordered alphabetically.
 *
 * Returns an empty array when the student has no mastery data yet.
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

    // ── 3. Parent–student link guard ──────────────────────────────────────────
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { status: true },
    });
    if (!link || link.status === 'revoked') {
      return NextResponse.json({ error: 'Student not linked' }, { status: 403 });
    }

    // ── 4. Per-subject aggregate ──────────────────────────────────────────────
    //
    // groupBy is Prisma's typed aggregate API — generates a single SQL GROUP BY
    // query. No raw SQL needed here because the grouping key (`subject`) is a
    // plain string column, not a computed expression.
    //
    // Prisma generates:
    //   SELECT subject, AVG(accuracy), COUNT(*)
    //   FROM "StudentTopicMastery"
    //   WHERE "studentId" = $1
    //   GROUP BY subject
    //   ORDER BY subject ASC
    const rows = await prisma.studentTopicMastery.groupBy({
      by: ['subject'],
      where: { studentId },
      _avg: { accuracy: true },
      _count: { topicId: true },
      orderBy: { subject: 'asc' },
    });

    // ── 5. Shape response ─────────────────────────────────────────────────────
    const subjectMastery: SubjectMastery[] = rows.map((r) => ({
      subject:     r.subject,
      // _avg.accuracy is null when there are no rows — guard with ?? 0
      avgAccuracy: Math.round((r._avg.accuracy ?? 0) * 10_000) / 10_000,
      topicCount:  r._count.topicId,
    }));

    const response = NextResponse.json(subjectMastery);

    logger.info('Parent subject mastery fetched', {
      className: CLASS_NAME,
      methodName: METHOD_NAME,
      parentId,
      studentId,
      subjectCount: subjectMastery.length,
    });

    logger.logAPI(req, response, { className: CLASS_NAME, methodName: METHOD_NAME }, start);
    return response;
  } catch (error) {
    logger.error('Failed to fetch parent subject mastery', {
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
