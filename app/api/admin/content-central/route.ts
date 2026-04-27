import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { formatErrorForResponse } from '@/lib/errorResponse'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const board = url.searchParams.get('board') || undefined;
    const classGrade = url.searchParams.get('class') || undefined;
    const language = url.searchParams.get('language') || undefined;
    const type = url.searchParams.get('type') || 'all';

    const items: any[] = [];

    // Syllabuses
    if (type === 'all' || type === 'syllabus') {
      const where: any = {};
      if (board) where.class = { some: { board: { name: board } } };
      if (classGrade) where.class = { some: { grade: Number(classGrade) } };
      const syllabi = await prisma.syllabus.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
      syllabi.forEach(s => items.push({ id: s.id, type: 'syllabus', label: s.title || s.id, createdAt: s.createdAt, metadata: { status: s.status } }));
    }

    // Chapters
    if (type === 'all' || type === 'chapter') {
      const where: any = { lifecycle: 'active' };
      if (language) where.language = language;
      const chapters = await prisma.chapterDef.findMany({ where, include: { subject: true }, orderBy: { createdAt: 'desc' }, take: 200 });
      chapters.forEach(c => items.push({ id: c.id, type: 'chapter', label: c.name, createdAt: c.createdAt, details: { subject: c.subject?.name }, metadata: { status: c.status } }));
    }

    // Topics
    if (type === 'all' || type === 'topic') {
      const where: any = { lifecycle: 'active' };
      if (language) where.language = language;
      const topics = await prisma.topicDef.findMany({ where, include: { chapter: { include: { subject: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
      topics.forEach(t => items.push({ id: t.id, type: 'topic', label: t.name, createdAt: t.createdAt, details: { chapterName: t.chapter?.name, subject: t.chapter?.subject?.name }, metadata: { status: t.status } }));
    }

    // Notes
    if (type === 'all' || type === 'note') {
      const where: any = { lifecycle: 'active' };
      if (language) where.language = language;
      const notes = await prisma.topicNote.findMany({ where, include: { topic: true }, orderBy: { createdAt: 'desc' }, take: 200 });
      notes.forEach(n => items.push({ id: n.id, type: 'note', label: n.title || n.id, createdAt: n.createdAt, details: { topicId: n.topicId }, metadata: { language: n.language, status: n.status } }));
    }

    // Tests
    if (type === 'all' || type === 'test') {
      const where: any = { lifecycle: 'active' };
      if (language) where.language = language;
      const tests = await prisma.generatedTest.findMany({ where, include: { topic: true }, orderBy: { createdAt: 'desc' }, take: 200 });
      tests.forEach(t => items.push({ id: t.id, type: 'test', label: t.title || t.id, createdAt: t.createdAt, details: { topicId: t.topicId }, metadata: { language: t.language, difficulty: t.difficulty, status: t.status } }));
    }

    const summary = {
      total: items.length,
      syllabus: items.filter(i=>i.type==='syllabus').length,
      chapters: items.filter(i=>i.type==='chapter').length,
      topics: items.filter(i=>i.type==='topic').length,
      notes: items.filter(i=>i.type==='note').length,
      tests: items.filter(i=>i.type==='test').length,
    };

    return NextResponse.json({ items, summary });
  } catch (err) {
    return NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
  }
}
