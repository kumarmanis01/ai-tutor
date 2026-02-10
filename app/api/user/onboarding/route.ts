import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
// Consolidated onboarding handler (merged onboarding-phone -> onboarding)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getDailyTask } from '@/lib/dailyHabit';

export async function POST(req: NextRequest) {
  const start = Date.now();
  let res: Response;
  try {
    const session = await getServerSessionForHandlers();
    // logApiUsage('/api/user/onboarding', 'POST', session?.user?.id); // replaced by logger.logAPI

    let userId: string | undefined;
    if (session && session.user && session.user.id) {
      userId = session.user.id as string;
    }

    const body = await req.json().catch(() => ({}));
    try {
      const masked = { ...body } as any;
      if (typeof masked.token === 'string') masked.token = `***${String(masked.token).slice(-8)}`;
      if (typeof masked.phone === 'string') masked.phone = String(masked.phone).replace(/\d(?=\d{4})/g, '*');
      logger.info('/api/user/onboarding received payload (masked)', { className: 'api.user.onboarding', methodName: 'POST', masked });
      const debugEnabled = String(process.env.DEBUG_ONBOARDING || '').toLowerCase() === '1' || String(process.env.DEBUG_ONBOARDING || '').toLowerCase() === 'true';
      if (debugEnabled) {
        logger.debug('/api/user/onboarding received payload (RAW)', { className: 'api.user.onboarding', methodName: 'POST', body });
      }
    } catch (logErr) {
      logger.warn('/api/user/onboarding: failed to mask/log payload', { className: 'api.user.onboarding', methodName: 'POST', error: logErr });
      logger.debug('/api/user/onboarding raw payload fallback', { className: 'api.user.onboarding', methodName: 'POST', body });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const gradeRaw = (typeof body.class_grade === 'number' || typeof body.class_grade === 'string') ? body.class_grade : body.grade;
    const grade = gradeRaw !== undefined && gradeRaw !== null ? String(gradeRaw) : undefined;
    const board = typeof body.board === 'string' ? body.board : undefined;
    const subjects = Array.isArray(body.subjects)
      ? (body.subjects as any[]).map((s) => (s == null ? '' : String(s))).filter((s) => s.length > 0)
      : undefined;
    const preferredLanguage = typeof body.preferred_language === 'string' ? body.preferred_language : undefined;
    const token = typeof body.token === 'string' ? body.token : undefined;
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : undefined;
    const phone = rawPhone ? rawPhone.replace(/[^0-9+]/g, '') : undefined;

    // Do not create users in onboarding. If there's no session user id, we will return 401 below.

    if (!userId) {
      res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
      return res;
    }

    // Enforce required fields for onboarding
    const fieldErrors: Record<string, string> = {};
    if (!name || name.trim() === '') fieldErrors.name = 'Name is required';
    if (!grade || String(grade).trim() === '') fieldErrors.class_grade = 'Class is required';
    if (!board || String(board).trim() === '') fieldErrors.board = 'Board is required';
    if (!preferredLanguage || String(preferredLanguage).trim() === '') fieldErrors.preferred_language = 'Preferred language is required';
    if (Object.keys(fieldErrors).length) {
      res = NextResponse.json({ error: 'validation_error', fieldErrors }, { status: 400 });
      logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
      return res;
    }

    // Server-side validation: verify subjects exist for the selected board+grade
    if (subjects && subjects.length > 0 && board && grade) {
      try {
        const validSubjects = await prisma.subjectDef.findMany({
          where: {
            class: {
              board: { slug: { equals: board, mode: 'insensitive' } },
              grade: Number(grade),
            },
            lifecycle: 'active',
          },
          select: { name: true },
        });
        const validNames = new Set(validSubjects.map((s) => s.name.toLowerCase()));
        const invalid = subjects.filter((s) => !validNames.has(s.toLowerCase()));
        if (invalid.length > 0) {
          fieldErrors.subjects = `Invalid subjects for ${board} grade ${grade}: ${invalid.join(', ')}`;
          res = NextResponse.json({ error: 'validation_error', fieldErrors }, { status: 400 });
          logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
          return res;
        }
      } catch (valErr) {
        // Non-blocking: if validation query fails, log and continue
        logger.warn('/api/user/onboarding: subject validation query failed', { className: 'api.user.onboarding', methodName: 'POST', error: valErr });
      }
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (grade) updates.grade = grade;
    if (board) updates.board = board;
    if (subjects) updates.subjects = subjects;
    if (preferredLanguage) updates.language = preferredLanguage;
    if (token) updates.lastWidgetToken = token;

    logger.info('/api/user/onboarding userId and updates', { className: 'api.user.onboarding', methodName: 'POST', userId, updates });
    let updatedUser;
    try {
      // First, ensure the user exists; if not, try to resolve via email or phone (without creating)
      const existingById = await prisma.user.findUnique({ where: { id: userId } });
      if (!existingById) {
        const email = typeof (session?.user as any)?.email === 'string' ? (session!.user as any).email : undefined;
        let resolvedUserId: string | undefined = undefined;
        if (email) {
          const byEmail = await prisma.user.findUnique({ where: { email } }).catch(() => null);
          if (byEmail) resolvedUserId = byEmail.id;
        }
        if (!resolvedUserId && phone) {
          const byPhone = await prisma.user.findUnique({ where: { phone } }).catch(() => null);
          if (byPhone) resolvedUserId = byPhone.id;
        }
        if (!resolvedUserId) {
          logger.warn('/api/user/onboarding: user not found (no create).', { className: 'api.user.onboarding', methodName: 'POST' });
          res = NextResponse.json({
            error: 'user_not_found',
            message: 'Your account record is missing. Please sign out and sign in again to re-link your account.',
          }, { status: 404 });
          logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
          return res;
        }
        userId = resolvedUserId as string;
      }

      updatedUser = await prisma.user.update({ where: { id: userId }, data: updates });
      logger.info('/api/user/onboarding updated user', { className: 'api.user.onboarding', methodName: 'POST', id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone });
    } catch (updErr: any) {
      if (updErr?.code === 'P2022') {
        logger.error('/api/user/onboarding: prisma schema mismatch on update P2022', { className: 'api.user.onboarding', methodName: 'POST', error: updErr });
        res = NextResponse.json({
          error: 'db_schema_mismatch',
          message: 'Database schema is out of sync with Prisma schema: one or more columns (e.g. `User.board`) are missing. Run `npx prisma migrate dev` to apply pending migrations.',
          details: updErr?.meta || String(updErr?.message),
        }, { status: 500 });
        logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
        return res;
      }
      // Handle Neon sleep or admin termination gracefully
      const msg = String(updErr?.message || updErr);
      // Handle record-not-found gracefully (P2025)
      if (updErr?.code === 'P2025' || msg.includes('No record was found for an update')) {
        // Attempt a friendly recovery: create or resolve by phone/email, else return 404 with guidance
        try {
          const email = typeof (session?.user as any)?.email === 'string' ? (session!.user as any).email : undefined;
          // Do NOT create; try to resolve and update only
          let fallbackUserId: string | undefined = undefined;
          if (phone) {
            const byPhone = await prisma.user.findUnique({ where: { phone } }).catch(() => null);
            if (byPhone) fallbackUserId = byPhone.id;
          }
          if (!fallbackUserId && email) {
            const byEmail = await prisma.user.findUnique({ where: { email } }).catch(() => null);
            if (byEmail) fallbackUserId = byEmail.id;
          }

          if (!fallbackUserId) {
            res = NextResponse.json({
              error: 'user_not_found',
              message: 'We could not find your user record to update. Please re-login to refresh your session.',
            }, { status: 404 });
            logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
            return res;
          }

          updatedUser = await prisma.user.update({ where: { id: fallbackUserId }, data: updates });
          userId = fallbackUserId;
          logger.info('/api/user/onboarding: updated resolved user after P2025', { className: 'api.user.onboarding', methodName: 'POST', id: updatedUser.id });

          res = NextResponse.json({ ok: true, user: { id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone } });
          logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
          return res;
        } catch (recoverErr: any) {
          logger.warn('/api/user/onboarding: failed to recover from P2025', { className: 'api.user.onboarding', methodName: 'POST', error: recoverErr });
          res = NextResponse.json({
            error: 'user_not_found',
            message: 'We could not find your user record to update. Please try again or re-login to refresh your session.',
          }, { status: 404 });
          logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
          return res;
        }
      }
      if (msg.includes('terminating connection due to administrator command') || msg.includes('E57P01')) {
        logger.warn('/api/user/onboarding: database temporarily unavailable (Neon sleep)', { className: 'api.user.onboarding', methodName: 'POST' });
        res = new NextResponse(JSON.stringify({ error: 'db_unavailable', message: 'Database temporarily unavailable. Please retry.' }), {
          status: 503,
          headers: { 'Retry-After': '3', 'Content-Type': 'application/json' },
        });
        logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
        return res;
      }
      throw updErr;
    }

    try {
      if (token) {
        await prisma.event.create({ data: { userId: updatedUser.id, type: 'otp_widget_token', metadata: { token }, timestamp: new Date() } });
      }
    } catch (evErr) {
      logger.warn('/api/user/onboarding: failed to persist widget token as event', { className: 'api.user.onboarding', methodName: 'POST', error: evErr });
    }

    // Trigger initial learning path generation (non-blocking)
    getDailyTask(updatedUser.id).catch((err) => {
      logger.warn('/api/user/onboarding: failed to seed initial daily task', { className: 'api.user.onboarding', methodName: 'POST', error: err });
    });

    res = NextResponse.json({ ok: true, user: { id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone } });
    logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('/api/user/onboarding error', { className: 'api.user.onboarding', methodName: 'POST', error: err });
    // Provide a clearer error message to avoid confusion for users
    res = NextResponse.json({ error: formatErrorForResponse(err), message: 'Something went wrong while saving your details. Please try again.' }, { status: 500 });
    logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
    return res;
  }
}
