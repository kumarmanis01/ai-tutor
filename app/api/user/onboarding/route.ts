import { logger } from '@/lib/logger';
// Consolidated onboarding handler (merged onboarding-phone -> onboarding)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSessionForHandlers();
    logApiUsage('/api/user/onboarding', 'POST', session?.user?.id);

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
      logger.warn('/api/user/onboarding: failed to mask/log payload', { className: 'api.user.onboarding', methodName: 'POST', error: String(logErr) });
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

    if (!userId && phone) {
      try {
        const boardCol: any = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'board' LIMIT 1`;
        if (!boardCol || (Array.isArray(boardCol) && boardCol.length === 0)) {
          logger.error('/api/user/onboarding: missing User.board column in DB', { className: 'api.user.onboarding', methodName: 'POST' });
          return NextResponse.json({
            error: 'db_schema_mismatch',
            message: 'Database schema is out of sync: column `User.board` is missing. Run `npx prisma migrate dev` to apply pending migrations.',
          }, { status: 500 });
        }
      } catch (schemaCheckErr) {
        logger.warn('/api/user/onboarding: failed to check DB schema for board column', { className: 'api.user.onboarding', methodName: 'POST', error: String(schemaCheckErr) });
      }
      try {
        logger.info('/api/user/onboarding: upserting user by phone', { className: 'api.user.onboarding', methodName: 'POST', phone });
        const user = await prisma.user.upsert({ where: { phone }, update: {}, create: { phone } });
        userId = user.id;
      } catch (e: any) {
        if (e?.code === 'P2022') {
          logger.error('/api/user/onboarding: prisma schema mismatch P2022', { className: 'api.user.onboarding', methodName: 'POST', error: String((e as any)?.meta || (e as any)?.message || e) });
          return NextResponse.json({
            error: 'db_schema_mismatch',
            message: 'Database schema is out of sync with Prisma schema: `User.phone` column missing. Run `npx prisma migrate dev` to apply pending migrations.',
            details: e?.meta || String(e?.message),
          }, { status: 500 });
        }
        logger.warn('/api/user/onboarding: upsert by phone failed, trying find/create', { className: 'api.user.onboarding', methodName: 'POST', error: String(e) });
        try {
          const existing = await prisma.user.findUnique({ where: { phone } });
          if (existing) userId = existing.id;
          else {
            const created = await prisma.user.create({ data: { phone } });
            userId = created.id;
          }
        } catch (e2: any) {
          if (e2?.code === 'P2022') {
            logger.error('/api/user/onboarding: prisma schema mismatch on find/create P2022', { className: 'api.user.onboarding', methodName: 'POST', error: String((e2 as any)?.meta || (e2 as any)?.message || e2) });
            return NextResponse.json({
              error: 'db_schema_mismatch',
              message: 'Database schema is out of sync with Prisma schema: `User.phone` column missing. Run `npx prisma migrate dev` to apply pending migrations.',
              details: e2?.meta || String(e2?.message),
            }, { status: 500 });
          }
          logger.error('/api/user/onboarding: failed to ensure user by phone', { className: 'api.user.onboarding', methodName: 'POST', error: String(e2) });
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!name && !grade && !board && !subjects && !preferredLanguage && !token) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
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
      // First, ensure the user exists; if not, try to resolve via email or phone
      const existingById = await prisma.user.findUnique({ where: { id: userId } });
      if (!existingById) {
        const email = typeof (session?.user as any)?.email === 'string' ? (session!.user as any).email : undefined;
        let resolvedUserId = userId;
        if (email) {
          const byEmail = await prisma.user.findUnique({ where: { email } }).catch(() => null);
          if (byEmail) resolvedUserId = byEmail.id;
        }
        if (!resolvedUserId && phone) {
          const byPhone = await prisma.user.findUnique({ where: { phone } }).catch(() => null);
          if (byPhone) resolvedUserId = byPhone.id;
        }
        if (!resolvedUserId) {
          // Create a minimal user record using available identifiers
          const created = await prisma.user.create({ data: { name: name || undefined, phone: phone || undefined, email: email || undefined } });
          resolvedUserId = created.id;
          logger.warn('/api/user/onboarding: user not found by id; created new', { className: 'api.user.onboarding', methodName: 'POST', createdId: resolvedUserId });
        }
        userId = resolvedUserId;
      }

      updatedUser = await prisma.user.update({ where: { id: userId }, data: updates });
      logger.info('/api/user/onboarding updated user', { className: 'api.user.onboarding', methodName: 'POST', id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone });
    } catch (updErr: any) {
      if (updErr?.code === 'P2022') {
        logger.error('/api/user/onboarding: prisma schema mismatch on update P2022', { className: 'api.user.onboarding', methodName: 'POST', error: String((updErr as any)?.meta || (updErr as any)?.message || updErr) });
        return NextResponse.json({
          error: 'db_schema_mismatch',
          message: 'Database schema is out of sync with Prisma schema: one or more columns (e.g. `User.board`) are missing. Run `npx prisma migrate dev` to apply pending migrations.',
          details: updErr?.meta || String(updErr?.message),
        }, { status: 500 });
      }
      // Handle Neon sleep or admin termination gracefully
      const msg = String(updErr?.message || updErr);
      // Handle record-not-found gracefully (P2025)
      if (updErr?.code === 'P2025' || msg.includes('No record was found for an update')) {
        // Attempt a friendly recovery: create or resolve by phone/email, else return 404 with guidance
        try {
          const email = typeof (session?.user as any)?.email === 'string' ? (session!.user as any).email : undefined;
          let fallbackUserId = userId;
          if (!fallbackUserId && phone) {
            const byPhone = await prisma.user.findUnique({ where: { phone } }).catch(() => null);
            if (byPhone) fallbackUserId = byPhone.id;
          }
          if (!fallbackUserId && email) {
            const byEmail = await prisma.user.findUnique({ where: { email } }).catch(() => null);
            if (byEmail) fallbackUserId = byEmail.id;
          }

          if (!fallbackUserId) {
            const created = await prisma.user.create({ data: { name: name || undefined, phone: phone || undefined, email: email || undefined, ...updates } });
            updatedUser = created;
            userId = created.id;
            logger.info('/api/user/onboarding: created new user after P2025', { className: 'api.user.onboarding', methodName: 'POST', id: created.id });
          } else {
            updatedUser = await prisma.user.update({ where: { id: fallbackUserId }, data: updates });
            userId = fallbackUserId;
            logger.info('/api/user/onboarding: updated resolved user after P2025', { className: 'api.user.onboarding', methodName: 'POST', id: updatedUser.id });
          }

          return NextResponse.json({ ok: true, user: { id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone } });
        } catch (recoverErr: any) {
          logger.warn('/api/user/onboarding: failed to recover from P2025', { className: 'api.user.onboarding', methodName: 'POST', error: String(recoverErr?.message || recoverErr) });
          return NextResponse.json({
            error: 'user_not_found',
            message: 'We could not find your user record to update. Please try again or re-login to refresh your session.',
          }, { status: 404 });
        }
      }
      if (msg.includes('terminating connection due to administrator command') || msg.includes('E57P01')) {
        logger.warn('/api/user/onboarding: database temporarily unavailable (Neon sleep)', { className: 'api.user.onboarding', methodName: 'POST' });
        return new NextResponse(JSON.stringify({ error: 'db_unavailable', message: 'Database temporarily unavailable. Please retry.' }), {
          status: 503,
          headers: { 'Retry-After': '3', 'Content-Type': 'application/json' },
        });
      }
      throw updErr;
    }

    try {
      if (token) {
        await prisma.event.create({ data: { userId: updatedUser.id, type: 'otp_widget_token', metadata: { token }, timestamp: new Date() } });
      }
    } catch (evErr) {
      logger.warn('/api/user/onboarding: failed to persist widget token as event', { className: 'api.user.onboarding', methodName: 'POST', error: String(evErr) });
    }

    return NextResponse.json({ ok: true, user: { id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone } });
  } catch (err) {
    logger.error('/api/user/onboarding error', { className: 'api.user.onboarding', methodName: 'POST', error: String(err) });
    // Provide a clearer error message to avoid confusion for users
    return NextResponse.json({ error: 'internal_error', message: 'Something went wrong while saving your details. Please try again.' }, { status: 500 });
  }
}
