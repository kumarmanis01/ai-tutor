/**
 * GET /api/admin/recommendation-trace?studentId=xxx
 *
 * Phase 6 — RecommendationTrace observability endpoint.
 *
 * Returns the most recent full RecommendationTrace for a student from Redis.
 * The trace is written by getNextAction() as a fire-and-forget side-effect
 * whenever ENABLE_REC_TRACE=1; this endpoint reads it back for admin debugging.
 *
 * Trace schema:
 *   traceId              — UUID from the getNextAction() call
 *   studentId            — student being recommended for
 *   evaluatedAt          — wall-clock timestamp (UTC ISO string after Redis round-trip)
 *   rules[]              — P0–P6 entries: { ruleId, evaluated, matched, durationMs }
 *   topicScoringBreakdown? — full ranked-topic signal table (only when P5 ran)
 *   finalDecision        — the NextAction returned to the student
 *
 * TTL: 10 minutes from last getNextAction() call for this student.
 *
 * Requirements:
 *   • Admin-only (role check via session).
 *   • Returns 400 when studentId is missing.
 *   • Returns 404 when no trace exists (expired, or ENABLE_REC_TRACE not set).
 *   • Returns 503 when ENABLE_REC_TRACE is off to surface config instructions.
 *
 * EDIT LOG:
 * - (previous) | — | GET live NextActionTrace via getNextAction(returnTrace: true)
 * - 2026-03-08 | claude | Phase 6: replaced live call with Redis read of persisted
 *                          full RecommendationTrace; kept 503 hint when flag is off;
 *                          maintained admin auth guard pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { readRecTrace, isRecTraceEnabled } from '@/lib/homeEngine/recommendationTrace';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ── Auth guard (admin only) ─────────────────────────────────────────────────
  const session = await getServerSessionForHandlers();
  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Validate input ──────────────────────────────────────────────────────────
  const studentId = req.nextUrl.searchParams.get('studentId');
  if (!studentId) {
    return NextResponse.json(
      { error: 'Missing studentId query parameter' },
      { status: 400 },
    );
  }

  // ── Feature flag hint ───────────────────────────────────────────────────────
  // Surface a clear config error rather than a confusing 404 when the flag is off.
  if (!isRecTraceEnabled()) {
    return NextResponse.json(
      {
        error: 'RecommendationTrace is disabled',
        hint: 'Set ENABLE_REC_TRACE=1 in your environment and trigger a recommendation to populate the trace.',
      },
      { status: 503 },
    );
  }

  // ── Read trace from Redis ───────────────────────────────────────────────────
  try {
    const trace = await readRecTrace(studentId);

    if (!trace) {
      return NextResponse.json(
        {
          error: 'No trace found for this student',
          hint: 'The trace expires after 10 minutes. Trigger a home-page load for this student then retry.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json(trace);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to read recommendation trace',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
