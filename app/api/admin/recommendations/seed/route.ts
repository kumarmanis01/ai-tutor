import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

// Seed recommendations for a cohort or a single user
export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  const role = (session?.user as any)?.role || 'user';
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const { userId, board, grade, language, subjects, perSubjectCount = 5 } = body;

  try {
    let users: { id: string; board: string | null; grade: string | null; language: string | null; subjects: string[] }[] = [];
    if (userId) {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      if (!u) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
      users = [{ id: u.id, board: u.board ?? null, grade: u.grade ?? null, language: u.language ?? 'en', subjects: (u.subjects || []) as string[] }];
    } else {
      users = await prisma.user.findMany({ where: { board, grade, language } }).then((arr) => arr.map((u) => ({ id: u.id, board: u.board, grade: u.grade, language: u.language, subjects: (u.subjects || []) as string[] })));
    }

    let seeded = 0;
    for (const u of users) {
      const subjSet = (subjects && Array.isArray(subjects) && subjects.length) ? subjects : (u.subjects || []);
      const where: any = { active: true, board: u.board || board, grade: u.grade || grade, language: u.language || language };
      if (subjSet && subjSet.length) where.subject = { in: subjSet };
      const catalog = await prisma.contentCatalog.findMany({ where, orderBy: { updatedAt: 'desc' } });
      const bySubject: Record<string, any[]> = {};
      for (const c of catalog) {
        bySubject[c.subject] = bySubject[c.subject] || [];
        if (bySubject[c.subject].length < perSubjectCount) bySubject[c.subject].push(c);
      }
      for (const subject of Object.keys(bySubject)) {
        for (const c of bySubject[subject]) {
          await prisma.contentRecommendation.upsert({
            where: { userId_contentId: { userId: u.id, contentId: c.contentId } },
            update: {},
            create: { userId: u.id, contentId: c.contentId, isShown: false, isClicked: false, isCompleted: false },
          });
          seeded++;
        }
      }
    }

    return NextResponse.json({ ok: true, seeded });
  } catch (e: any) {
    return NextResponse.json({ error: 'seed_failed', message: String(e?.message || e) }, { status: 500 });
  }
}
