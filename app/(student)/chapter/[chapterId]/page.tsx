/**
 * FILE OBJECTIVE:
 * - Server entry point for /chapter/[chapterId]. Fetches chapter metadata and
 *   topic names (structural data only) from the DB, then renders the chapter
 *   session shell. All learning content is AI-generated on demand -- the DB is
 *   only queried for chapter/topic names used in the dropdown and hero card.
 *
 * EDIT LOG:
 * - 2026-06-09T19:30:00Z | claude | pass topics as name/id pairs for question tab dropdown
 * - 2026-06-09T18:00:00Z | claude | fetch full topics with names + content counts for pipeline UI
 * - 2026-06-09T16:00:00Z | claude | moved from /session/chapter/ to /chapter/; redesign with tokens
 * - 2026-06-09T12:00:00Z | claude | initial implementation
 */

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { ChapterSessionView } from '@/components/session/chapter/ChapterSessionView';

interface Props {
  params: Promise<{ chapterId: string }>;
}

export default async function ChapterSessionPage({ params }: Props) {
  const { chapterId } = await params;

  const auth = await getServerSessionForHandlers();
  if (!auth?.user?.id) {
    redirect(`/auth/login?callbackUrl=/chapter/${chapterId}`);
  }

  const [chapter, userProfile] = await Promise.all([
    prisma.chapterDef.findUnique({
      where: { id: chapterId },
      select: {
        name: true,
        topics: {
          where: { lifecycle: 'active' },
          select: { id: true, name: true },
          orderBy: { order: 'asc' },
        },
        subject: {
          select: {
            name: true,
            class: {
              select: {
                grade: true,
                board: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { grade: true, board: true },
    }),
  ]);

  if (!chapter) {
    redirect('/learn');
  }

  const grade =
    chapter.subject?.class?.grade != null
      ? String(chapter.subject.class.grade)
      : (userProfile?.grade ?? '');
  const board = chapter.subject?.class?.board?.name ?? userProfile?.board ?? '';
  const subjectName = chapter.subject?.name ?? '';

  return (
    <ChapterSessionView
      chapterId={chapterId}
      chapterName={chapter.name}
      subjectName={subjectName}
      grade={grade}
      board={board}
      topics={chapter.topics ?? []}
    />
  );
}
