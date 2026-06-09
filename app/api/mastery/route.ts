/**
 * FILE OBJECTIVE:
 * - GET /api/mastery: returns a paginated list of TopicProgress records
 *   filtered by mastery state for the authenticated student.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | S2-2 PART B: initial creation
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getDevelopingTopics, getProgressByState } from '@/lib/mastery/topicProgress';
import { MasteryState } from '@prisma/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const VALID_STATES = new Set<string>(['NOT_STARTED', 'DEVELOPING', 'MASTERED']);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const user = session?.user;
  if (!user?.id) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'MasteryAPI', methodName: 'GET' }, start);
    return res;
  }

  const { searchParams } = new URL(req.url);
  const stateParam = searchParams.get('state') ?? 'DEVELOPING';
  const limitParam = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);

  if (!VALID_STATES.has(stateParam)) {
    const res = NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    logger.logAPI(req, res, { className: 'MasteryAPI', methodName: 'GET' }, start);
    return res;
  }

  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const state = stateParam as MasteryState;

  try {
    const topics = state === MasteryState.DEVELOPING
      ? await getDevelopingTopics(user.id, limit)
      : await getProgressByState(user.id, state, limit);

    const res = NextResponse.json({ topics, total: topics.length });
    logger.logAPI(req, res, { className: 'MasteryAPI', methodName: 'GET' }, start);
    return res;
  } catch (err) {
    logger.error('MasteryAPI.GET', { userId: user.id, state, error: err });
    const res = NextResponse.json({ error: 'Failed to fetch mastery data' }, { status: 500 });
    logger.logAPI(req, res, { className: 'MasteryAPI', methodName: 'GET' }, start);
    return res;
  }
}
