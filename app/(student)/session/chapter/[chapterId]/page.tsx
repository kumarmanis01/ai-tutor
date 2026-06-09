/**
 * FILE OBJECTIVE:
 * - Server entry point for /session/chapter/[chapterId]. Resolves chapter metadata
 *   (name, subject, grade, board) and renders ChapterSessionView -- the 5-tab
 *   on-demand chapter session shell. Nothing is pre-generated or persisted;
 *   all AI content is streamed on demand by the client.
 *
 * EDIT LOG:
 * - 2026-06-09T12:00:00Z | claude | initial implementation for chapter session page
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
    redirect(`/auth/login?callbackUrl=/session/chapter/${chapterId}`);
  }

  const [chapter, userProfile] = await Promise.all([
    prisma.chapterDef.findUnique({
      where: { id: chapterId },
      select: {
        name: true,
        slug: true,
        topics: {
          where: { lifecycle: 'active' },
          select: { id: true },
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

  // Prefer chapter-derived grade/board; fall back to user profile
  const grade =
    chapter.subject?.class?.grade != null
      ? String(chapter.subject.class.grade)
      : (userProfile?.grade ?? '');
  const board = chapter.subject?.class?.board?.name ?? userProfile?.board ?? '';
  const subjectName = chapter.subject?.name ?? '';
  const topicCount = chapter.topics?.length ?? 0;

  return (
    <ChapterSessionView
      chapterId={chapterId}
      chapterName={chapter.name}
      subjectName={subjectName}
      grade={grade}
      board={board}
      topicCount={topicCount}
    />
  );
}
