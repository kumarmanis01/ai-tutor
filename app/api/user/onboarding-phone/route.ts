// Removed duplicate implementation
import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSessionForHandlers();
    logApiUsage('/api/user/onboarding-phone', 'POST', session?.user?.id);
    // We rely on a valid NextAuth session for authenticated flows. If the
    // client is not signed in yet but submitted a `phone` in the body, we
    // will upsert based on phone. The previous `onboard_user_id` cookie
    // bridge is removed in favor of a real NextAuth session created after
    // MSG91 verification.
    let userId: string | undefined;
    if (session && session.user && session.user.id) {
      userId = session.user.id as string;
    }

    const body = await req.json().catch(() => ({}));
    // Log the received payload from the signup form. We keep a masked log
    // always, and optionally output the full raw payload for local debugging
    // when DEBUG_ONBOARDING is set to '1'.
    try {
      const masked = { ...body } as any;
      if (typeof masked.token === 'string') masked.token = `***${String(masked.token).slice(-8)}`;
      if (typeof masked.phone === 'string') masked.phone = String(masked.phone).replace(/\d(?=\d{4})/g, '*');
      console.info('/api/user/onboarding-phone received payload (masked):', masked);

      const debugEnabled = String(process.env.DEBUG_ONBOARDING || '').toLowerCase() === '1' || String(process.env.DEBUG_ONBOARDING || '').toLowerCase() === 'true';
      if (debugEnabled) {
        // Developer explicitly requested full logging for debugging.
        console.debug('/api/user/onboarding-phone received payload (RAW):', body);
      }
    } catch (logErr) {
      console.warn('/api/user/onboarding-phone: failed to mask/log payload', logErr);
      console.debug('/api/user/onboarding-phone raw payload fallback:', body);
    }
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    // accept either `grade` or `class_grade` from client; store as string
    const gradeRaw = (typeof body.class_grade === 'number' || typeof body.class_grade === 'string') ? body.class_grade : body.grade;
    const grade = gradeRaw !== undefined && gradeRaw !== null ? String(gradeRaw) : undefined;
    const board = typeof body.board === 'string' ? body.board : undefined;
    // Normalize subjects: ensure an array of non-empty strings or undefined
    const subjects = Array.isArray(body.subjects)
      ? (body.subjects as any[]).map((s) => (s == null ? '' : String(s))).filter((s) => s.length > 0)
      : undefined;
    const preferredLanguage = typeof body.preferred_language === 'string' ? body.preferred_language : undefined;
    const token = typeof body.token === 'string' ? body.token : undefined;
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : undefined;
    const phone = rawPhone ? rawPhone.replace(/[^0-9+]/g, '') : undefined;

    // If no session/cookie userId but a phone is present, upsert (create) user by phone
    if (!userId && phone) {
      // Ensure DB schema has expected columns before attempting upsert. If the
      // schema is out of sync (e.g., missing `board` column) Prisma upsert
      // will throw P2022 when it tries to read/write model fields. Check for
      // the `board` column and bail with a helpful error if missing.
      try {
        const boardCol: any = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'board' LIMIT 1`;
        if (!boardCol || (Array.isArray(boardCol) && boardCol.length === 0)) {
          console.error('/api/user/onboarding-phone: missing User.board column in DB');
          return NextResponse.json({
            error: 'db_schema_mismatch',
            message: 'Database schema is out of sync: column `User.board` is missing. Run `npx prisma migrate dev` to apply pending migrations.',
          }, { status: 500 });
        }
      } catch (schemaCheckErr) {
        console.warn('/api/user/onboarding-phone: failed to check DB schema for board column', schemaCheckErr);
        // Fallthrough — we'll attempt the upsert and let Prisma report any errors.
      }
      try {
        console.info('/api/user/onboarding-phone: upserting user by phone', { phone });
        const user = await prisma.user.upsert({
          where: { phone },
          update: {},
          create: { phone },
        });
        userId = user.id;
      } catch (e: any) {
        // Handle schema mismatch where DB doesn't have `phone` column (Prisma P2022)
        if (e?.code === 'P2022') {
          console.error('/api/user/onboarding-phone: prisma schema mismatch P2022', e.meta || e.message);
          return NextResponse.json({
            error: 'db_schema_mismatch',
            message: 'Database schema is out of sync with Prisma schema: `User.phone` column missing. Run `npx prisma migrate dev` to apply pending migrations.',
            details: e?.meta || String(e?.message),
          }, { status: 500 });
        }

        console.warn('/api/user/onboarding-phone: upsert by phone failed, trying find/create', e);
        try {
          const existing = await prisma.user.findUnique({ where: { phone } });
          if (existing) {
            userId = existing.id;
          } else {
            const created = await prisma.user.create({ data: { phone } });
            userId = created.id;
          }
        } catch (e2: any) {
          if (e2?.code === 'P2022') {
            console.error('/api/user/onboarding-phone: prisma schema mismatch on find/create P2022', e2.meta || e2.message);
            return NextResponse.json({
              error: 'db_schema_mismatch',
              message: 'Database schema is out of sync with Prisma schema: `User.phone` column missing. Run `npx prisma migrate dev` to apply pending migrations.',
              details: e2?.meta || String(e2?.message),
            }, { status: 500 });
          }
          console.error('/api/user/onboarding-phone: failed to ensure user by phone', e2);
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

    console.info('/api/user/onboarding-phone userId and updates', { userId, updates });
    let updatedUser;
    try {
      updatedUser = await prisma.user.update({ where: { id: userId }, data: updates });
      console.info('/api/user/onboarding-phone updated user', { id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone });
    } catch (updErr: any) {
      // Catch common Prisma schema mismatch (P2022) and return a helpful error
      if (updErr?.code === 'P2022') {
        console.error('/api/user/onboarding-phone: prisma schema mismatch on update P2022', updErr.meta || updErr.message);
        return NextResponse.json({
          error: 'db_schema_mismatch',
          message: 'Database schema is out of sync with Prisma schema: one or more columns (e.g. `User.board`) are missing. Run `npx prisma migrate dev` to apply pending migrations.',
          details: updErr?.meta || String(updErr?.message),
        }, { status: 500 });
      }
      throw updErr;
    }

    // If the client provided a widget token, record it as an Event for audit/processing.
    try {
      if (token) {
        await prisma.event.create({ data: { userId: updatedUser.id, type: 'otp_widget_token', metadata: { token }, timestamp: new Date() } });
      }
    } catch (evErr) {
      console.warn('/api/user/onboarding-phone: failed to persist widget token as event', evErr);
    }

    return NextResponse.json({ ok: true, user: { id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone } });
  } catch (err) {
    console.error('/api/user/onboarding-phone error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
