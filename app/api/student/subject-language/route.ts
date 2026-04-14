/**
 * F-STU-004 AC-01/04: Per-subject teaching language preference.
 *
 * GET  /api/student/subject-language
 *   Returns { subjectLanguages: Record<subjectId, 'en' | 'hi' | 'hinglish'> }
 *
 * PATCH /api/student/subject-language
 *   Body: { subjectId: string, language: 'en' | 'hi' | 'hinglish' }
 *   Persists preference in StudentLearningProfile.recommendations JSON under
 *   the "subjectLanguages" key (no schema migration required).
 *
 * EDIT LOG:
 * - 2026-04-14 | claude | created for F-STU-004 AC-01/04
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const VALID_LANGUAGES = ['en', 'hi', 'hinglish'] as const;
type SubjectLanguage = (typeof VALID_LANGUAGES)[number];

export async function GET(req: NextRequest) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'SubjectLanguageAPI', methodName: 'GET' }, start);
    return res;
  }

  const profile = await prisma.studentLearningProfile.findUnique({
    where: { studentId: userId },
    select: { recommendations: true },
  });

  const recommendations = (profile?.recommendations as Record<string, unknown>) ?? {};
  const subjectLanguages = (recommendations.subjectLanguages as Record<string, string>) ?? {};

  const res = NextResponse.json({ subjectLanguages });
  logger.logAPI(req, res, { className: 'SubjectLanguageAPI', methodName: 'GET' }, start);
  return res;
}

export async function PATCH(req: NextRequest) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'SubjectLanguageAPI', methodName: 'PATCH' }, start);
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const subjectId = typeof body.subjectId === 'string' ? body.subjectId.trim() : null;
  const language = typeof body.language === 'string' ? body.language.trim() as SubjectLanguage : null;

  if (!subjectId) {
    const res = NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'SubjectLanguageAPI', methodName: 'PATCH' }, start);
    return res;
  }

  if (!language || !VALID_LANGUAGES.includes(language)) {
    const res = NextResponse.json(
      { error: `language must be one of: ${VALID_LANGUAGES.join(', ')}` },
      { status: 400 },
    );
    logger.logAPI(req, res, { className: 'SubjectLanguageAPI', methodName: 'PATCH' }, start);
    return res;
  }

  // Load existing recommendations, merge in the new language, and upsert
  const existing = await prisma.studentLearningProfile.findUnique({
    where: { studentId: userId },
    select: { recommendations: true },
  });
  const recommendations = (existing?.recommendations as Record<string, unknown>) ?? {};
  const subjectLanguages = { ...((recommendations.subjectLanguages as Record<string, string>) ?? {}), [subjectId]: language };

  await prisma.studentLearningProfile.upsert({
    where: { studentId: userId },
    update: { recommendations: { ...recommendations, subjectLanguages } },
    create: { studentId: userId, recommendations: { subjectLanguages } },
  });

  const res = NextResponse.json({ ok: true, subjectId, language });
  logger.logAPI(req, res, { className: 'SubjectLanguageAPI', methodName: 'PATCH' }, start);
  return res;
}
