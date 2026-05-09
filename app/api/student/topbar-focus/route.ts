/**
 * FILE OBJECTIVE:
 * - GET /api/student/topbar-focus returns real continuation-focused topbar payload
 *   derived from deterministic Home Engine recommendation output.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/student/topbar-focus/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | add typed topbar focus endpoint backed by getNextAction and streak context
 */

import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { getNextAction, type NextAction } from '@/lib/homeEngine/getNextAction';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type {
  StudentTopbarFocus,
  StudentTopbarFocusResponse,
  StudentTopbarMode,
} from '@/lib/api/student/topbarContract';

export const dynamic = 'force-dynamic';

const TOPBAR_ACTION_ROUTES = {
  dashboard: '/dashboard',
  doubts: '/doubts',
  learn: '/learn',
  homework: '/dashboard',
} as const;

const SEARCH_HINTS: Record<StudentTopbarMode, string> = {
  active: 'Search this chapter concepts',
  exam: 'Search formulas and revision questions',
  weak: 'Ask why this method works',
  recovery: 'Search examples and quick recap',
};

type GetNextActionReturn = Awaited<ReturnType<typeof getNextAction>>;

function extractAction(result: GetNextActionReturn): NextAction | null {
  if (!result) return null;
  if ('action' in result) return result.action;
  return result;
}

function resolveMode(action: NextAction | null, streak: number): StudentTopbarMode {
  if (!action) return streak > 0 ? 'active' : 'recovery';

  switch (action.ruleId) {
    case 'homework_pending':
    case 'spaced_revision':
      return 'exam';
    case 'weak_topic_urgent':
      return 'weak';
    case 'inactive_return':
      return 'recovery';
    case 'resume_session':
    case 'next_new_topic':
    case 'all_topics_complete':
    default:
      return streak > 0 ? 'active' : 'recovery';
  }
}

function buildFocusLabel(action: NextAction | null, mode: StudentTopbarMode): string {
  if (!action) {
    return mode === 'recovery'
      ? 'Welcome back. Resume where you paused.'
      : 'Continue: Today\'s recommended lesson';
  }

  if (action.ruleId === 'resume_session' && action.topicName) {
    return `Continue: ${action.topicName}`;
  }

  if (action.ruleId === 'weak_topic_urgent' && action.topicName) {
    return `Strengthen ${action.topicName} with guided examples`;
  }

  if (action.ruleId === 'spaced_revision' && action.topicName) {
    return `Revision: ${action.topicName}`;
  }

  if (action.ruleId === 'homework_pending' && action.topicName) {
    return `Complete homework: ${action.topicName}`;
  }

  if (action.topicName) {
    return `Continue: ${action.topicName}`;
  }

  return action.reasonLabel || 'Continue with today\'s learning';
}

function buildEtaLabel(action: NextAction | null, mode: StudentTopbarMode): string {
  if (action?.estimatedTimeMin && action.estimatedTimeMin > 0) {
    return `${action.estimatedTimeMin} mins left`;
  }

  if (mode === 'exam') return '2 short tasks today';
  if (mode === 'weak') return 'Step-by-step support ready';
  if (mode === 'recovery') return 'Fresh start available today';
  return '12 mins left';
}

function buildAskLabel(mode: StudentTopbarMode): string {
  if (mode === 'exam') return 'Ask Vidya for quick revision';
  if (mode === 'weak') return 'Ask Vidya to explain step by step';
  if (mode === 'recovery') return 'Need a quick recap? Ask Vidya';
  return 'Stuck on a step? Ask Vidya';
}

function buildContextTag(mode: StudentTopbarMode): string {
  if (mode === 'exam') return 'Exam mode';
  if (mode === 'weak') return 'Support mode';
  if (mode === 'recovery') return 'Recovery mode';
  return 'Active session';
}

function buildMomentumLabel(mode: StudentTopbarMode, streak: number): string {
  if (streak <= 0) return 'Fresh start streak available';
  if (mode === 'exam') return 'You are on track';
  if (mode === 'weak') return 'Progress grows with each attempt';
  return `${streak}-day learning consistency`;
}

function buildActionHref(action: NextAction | null): string {
  if (!action) return TOPBAR_ACTION_ROUTES.dashboard;
  if (action.sessionId) return `/session/${action.sessionId}`;
  if (action.assignmentId) return TOPBAR_ACTION_ROUTES.homework;

  if (action.actionType === 'practice' || action.actionType === 'revision') {
    return TOPBAR_ACTION_ROUTES.learn;
  }

  return TOPBAR_ACTION_ROUTES.learn;
}

function buildTopbarFocus(action: NextAction | null, streak: number): StudentTopbarFocus {
  const mode = resolveMode(action, streak);

  return {
    mode,
    focusLabel: buildFocusLabel(action, mode),
    etaLabel: buildEtaLabel(action, mode),
    askLabel: buildAskLabel(mode),
    momentumLabel: buildMomentumLabel(mode, streak),
    contextTag: buildContextTag(mode),
    searchPlaceholder: SEARCH_HINTS[mode],
    actionHref: buildActionHref(action),
    sourceRuleId: action?.ruleId ?? 'all_topics_complete',
  };
}

export async function GET(req: Request) {
  const start = Date.now();

  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    const unauthorizedResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, unauthorizedResponse, { className: 'StudentTopbarFocusAPI', methodName: 'GET' }, start);
    return unauthorizedResponse;
  }

  try {
    const [actionResult, user] = await Promise.all([
      getNextAction(userId),
      prisma.user.findUnique({ where: { id: userId }, select: { currentStreak: true } }),
    ]);

    const action = extractAction(actionResult);
    const streak = user?.currentStreak ?? 0;
    const payload: StudentTopbarFocusResponse = {
      focus: buildTopbarFocus(action, streak),
      generatedAt: new Date().toISOString(),
    };

    const okResponse = NextResponse.json(payload);
    logger.logAPI(req, okResponse, { className: 'StudentTopbarFocusAPI', methodName: 'GET' }, start);
    return okResponse;
  } catch (error) {
    logger.error('StudentTopbarFocusAPI.error', { userId, error });

    const fallbackPayload: StudentTopbarFocusResponse = {
      focus: buildTopbarFocus(null, 0),
      generatedAt: new Date().toISOString(),
    };

    const fallbackResponse = NextResponse.json(fallbackPayload);
    logger.logAPI(req, fallbackResponse, { className: 'StudentTopbarFocusAPI', methodName: 'GET' }, start);
    return fallbackResponse;
  }
}
