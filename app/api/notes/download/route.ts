import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const noteId = typeof body.noteId === 'string' ? body.noteId : undefined;
  if (!noteId) return NextResponse.json({ error: 'invalid_note' }, { status: 400 });

  try {
    await prisma.noteDownload.create({ data: { noteId, userId: session.user.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'failed', message: String(e) }, { status: 500 });
  }
}
