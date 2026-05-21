/**
 * FILE OBJECTIVE:
 * - Save student enrollment data and return whether DPDP parent consent is required.
 * - Accepts all fields from the enrollment form in a single POST.
 * - Upserts the user record and returns { ok, needsParentConsent }.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/enroll/save/route.test.ts
 *
 * EDIT LOG:
 * - 2026-05-05 | claude | created for flat enrollment form
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { invalidateUserSessionCache } from '@/lib/auth';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { DPDP_MINOR_AGE } from '@/lib/constants/age';
import { LanguageCode } from '@prisma/client';
import { enqueueSubjectHydration } from '@/lib/diagnostics/enqueueSubjectHydration';

export const dynamic = 'force-dynamic';

function calcAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function isValidEmail(s: string): boolean {
  return typeof s === 'string' && s.includes('@') && !s.includes(' ');
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  let res: Response;
  try {
    const session = await getServerSessionForHandlers();
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'EnrollSaveAPI', methodName: 'POST' }, start);
      return res;
    }

    const body = await req.json().catch(() => ({}));

    // ── Field extraction ──────────────────────────────────────────────────────
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const dobRaw = typeof body.dateOfBirth === 'string' ? body.dateOfBirth.trim() : undefined;
    const language = typeof body.language === 'string' ? body.language.trim() : undefined;
    const board = typeof body.board === 'string' ? body.board.trim() : undefined;
    const grade = typeof body.grade === 'string' ? body.grade.trim() : (typeof body.grade === 'number' ? String(body.grade) : undefined);
    const schoolName = typeof body.schoolName === 'string' ? body.schoolName.trim() : undefined;
    const subjects: string[] = Array.isArray(body.subjects)
      ? [...new Set((body.subjects as unknown[]).map((s) => String(s ?? '').toLowerCase().replace(/\s+/g, '-')).filter((s) => s.length > 0))]
      : [];
    const selfPhone = typeof body.selfPhone === 'string' ? body.selfPhone.replace(/[^0-9+]/g, '') : undefined;
    const selfEmail = typeof body.selfEmail === 'string' ? body.selfEmail.trim().toLowerCase() : undefined;
    const parentPhone = typeof body.parentPhone === 'string' ? body.parentPhone.replace(/[^0-9+]/g, '') : undefined;
    const parentEmail = typeof body.parentEmail === 'string' ? body.parentEmail.trim().toLowerCase() : undefined;

    // ── Validation ────────────────────────────────────────────────────────────
    const errors: Record<string, string> = {};
    if (!name) errors.name = 'Name is required';
    if (!dobRaw) errors.dateOfBirth = 'Date of birth is required';
    if (!language) errors.language = 'Language is required';
    if (!board) errors.board = 'Board is required';
    if (!grade) errors.grade = 'Grade is required';
    if (subjects.length === 0) errors.subjects = 'Select at least one subject';
    if (selfEmail && !isValidEmail(selfEmail)) errors.selfEmail = 'Invalid email address';
    if (parentEmail && !isValidEmail(parentEmail)) errors.parentEmail = 'Invalid parent email address';

    if (Object.keys(errors).length > 0) {
      res = NextResponse.json({ error: 'validation_error', fields: errors }, { status: 400 });
      logger.logAPI(req, res, { className: 'EnrollSaveAPI', methodName: 'POST' }, start);
      return res;
    }

    // ── DOB + age ─────────────────────────────────────────────────────────────
    const dob = new Date(dobRaw!);
    if (isNaN(dob.getTime())) {
      res = NextResponse.json({ error: 'validation_error', fields: { dateOfBirth: 'Invalid date' } }, { status: 400 });
      logger.logAPI(req, res, { className: 'EnrollSaveAPI', methodName: 'POST' }, start);
      return res;
    }
    const age = calcAge(dob);
    const needsParentConsent = age < DPDP_MINOR_AGE;

    // DPDP: if under-age, at least one parent contact is required
    if (needsParentConsent && !parentEmail && !parentPhone) {
      res = NextResponse.json(
        { error: 'validation_error', fields: { parentEmail: 'Parent contact required for students under ${DPDP_MINOR_AGE} (DPDP)' } },
        { status: 400 },
      );
      logger.logAPI(req, res, { className: 'EnrollSaveAPI', methodName: 'POST' }, start);
      return res;
    }

    // ── Persist user data ─────────────────────────────────────────────────────
    const langCode = (language === 'hi' ? 'hi' : 'en') as LanguageCode;

    const updateData: Record<string, unknown> = {
      name,
      dateOfBirth: dob,
      age,
      language: langCode,
      // grade/board immutable after first save -- strip from all PATCH handlers
      board,
      grade,
      subjects,
    };
    if (schoolName) updateData.schoolName = schoolName;
    if (selfPhone) updateData.phone = selfPhone;
    if (selfEmail) updateData.email = selfEmail;
    if (parentPhone) updateData.parentPhone = parentPhone;
    if (parentEmail) updateData.parentEmail = parentEmail;
    if (needsParentConsent) updateData.requiresParentVerification = true;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData as Parameters<typeof prisma.user.update>[0]['data'],
      select: {
        id: true,
        board: true,
        grade: true,
        language: true,
        subjects: true,
        parentEmail: true,
        parentPhone: true,
        parentVerifiedAt: true,
      },
    });

    // Best-effort: invalidate session cache so JWT reflects updated profile fields
    try {
      await invalidateUserSessionCache((session?.user as any)?.email);
    } catch (e) {
      logger.warn('enroll.save: cache invalidation failed', { className: 'EnrollSaveAPI', methodName: 'POST', error: String(e) });
    }

    // ── Trigger content seeding (non-blocking) ────────────────────────────────
    try {
      if (updated.board && updated.grade) {
        const gradeNum = Number(updated.grade);
        const boardSlug = updated.board;
        for (const subjectSlug of subjects) {
          await enqueueSubjectHydration({ boardSlug, grade: gradeNum, subjectSlug }).catch(() => {});
        }
        // Bootstrap job requires a completed diagnostic session -- not triggered at enrollment.
      }
    } catch {
      // non-blocking
    }

    const alreadyVerified = updated.parentVerifiedAt != null;

    res = NextResponse.json({
      ok: true,
      needsParentConsent,
      parentConsentAlreadyVerified: alreadyVerified,
      userId,
    });
    logger.logAPI(req, res, { className: 'EnrollSaveAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('/api/enroll/save error', { className: 'EnrollSaveAPI', methodName: 'POST', error: err });
    res = NextResponse.json({ error: formatErrorForResponse(err), message: 'Failed to save enrollment data' }, { status: 500 });
    logger.logAPI(req, res, { className: 'EnrollSaveAPI', methodName: 'POST' }, start);
    return res;
  }
}
