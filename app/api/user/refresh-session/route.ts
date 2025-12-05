import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const session = await getServerSessionForHandlers();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!dbUser) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Return minimal identity that mirrors the session's minimal shape.
    return NextResponse.json({
      id: dbUser.id,
      name: dbUser.name ?? null,
      email: dbUser.email ?? null,
      image: dbUser.image ?? null,
      role: dbUser.role ?? null,
    });
  } catch (err) {
    console.error('POST /api/user/refresh-session error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
