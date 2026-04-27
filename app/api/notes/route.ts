import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSessionForHandlers } from '@/lib/session';
import { assertNoStringFilters } from '@/lib/guards/noStringFilters';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    try { assertNoStringFilters(req); } catch (e) {
      return NextResponse.json({ error: formatErrorForResponse(e) }, { status: 400 });
    }

    const session = await getServerSessionForHandlers();
    if (!session?.user?.id) return NextResponse.json({ notes: [] });

    const { searchParams } = new URL(req.url);
    const language = searchParams.get('language');
    const board = searchParams.get('board');
    const grade = searchParams.get('grade');
    const subject = searchParams.get('subject');
    const q = searchParams.get('q');

    // Build query: include user's own notes OR public notes matching filters
    const publicStudentWhere: any = {};
    if (language) publicStudentWhere.language = language;
    if (board) publicStudentWhere.board = board;
    if (grade) publicStudentWhere.grade = grade;

    const publicWhere: any = { isPublic: true };
    if (Object.keys(publicStudentWhere).length > 0) publicWhere.student = publicStudentWhere;
    if (subject) publicWhere.subject = subject;
    if (q) publicWhere.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { content: { contains: q, mode: 'insensitive' } },
    ];

    const ownWhere: any = { studentId: session.user.id };
    if (subject) ownWhere.subject = subject;
    if (q) ownWhere.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { content: { contains: q, mode: 'insensitive' } },
    ];

    const notes = await prisma.note.findMany({
      where: { OR: [ownWhere, publicWhere] },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ notes });
  } catch (err) {
    logger.error('/api/notes error', { error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const note = await prisma.note.create({ data });
    return NextResponse.json(note);
  } catch (err) {
    logger.error('/api/notes POST error', { error: err });
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
