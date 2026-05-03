import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/student/consent-status
 * Returns the current accountStatus for the authenticated student.
 * Used by the consent-wait page to poll for parent approval.
 */
export async function GET(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        accountStatus: true,
        parentPhoneVerifiedAt: true,
        subjects: true,
        grade: true,
      },
    });

    if (!user) {
      return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
    }

    const consentGranted =
      user.accountStatus === 'active' || user.parentPhoneVerifiedAt !== null;

    // Resolve first subject id for the diagnostic CTA
    let firstSubjectId: string | null = null;
    const rawSubjects = user.subjects;
    const slugs: string[] = Array.isArray(rawSubjects)
      ? (rawSubjects as string[]).filter(Boolean)
      : typeof rawSubjects === 'string' && rawSubjects.length > 0
        ? rawSubjects.replace(/^\{/, '').replace(/\}$/, '').split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    if (slugs.length > 0) {
      const sub = await prisma.subjectDef.findFirst({
        where: {
          OR: [{ name: { in: slugs } }, { slug: { in: slugs } }],
          lifecycle: 'active',
        },
        select: { id: true },
      });
      firstSubjectId = sub?.id ?? null;
    }

    return NextResponse.json({
      consentGranted,
      accountStatus: user.accountStatus,
      firstSubjectId,
    });
  } catch (err) {
    logger.error('consent-status.error', { error: String(err) });
    return NextResponse.json({ code: 'SERVER_ERROR' }, { status: 500 });
  }
}
