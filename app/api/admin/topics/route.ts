import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') ?? undefined;
  const take = Math.min(Number(searchParams.get('limit') ?? '50'), 100);
  const skip = Number(searchParams.get('offset') ?? '0');

  const topics = await prisma.topicDef.findMany({
    where: {
      lifecycle: 'active',
      ...(status ? { status: status as never } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      chapterId: true,
      chapter: { select: { name: true } },
    },
    orderBy: [{ chapterId: 'asc' }, { order: 'asc' }],
    take,
    skip,
  });

  return NextResponse.json(topics);
}
