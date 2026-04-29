import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AiContentViewer from './AiContentViewer';

interface Params {
  params: Promise<{ contentId: string }>;
}

export default async function AiContentPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { contentId } = await params;

  const record = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      topic: true,
      subject: true,
      grade: true,
      board: true,
      language: true,
      status: true,
      contentJson: true,
      createdAt: true,
    },
  });

  if (!record || (record.status !== 'APPROVED' && record.status !== 'PENDING_REVIEW')) {
    notFound();
  }

  const json = record.contentJson as Record<string, unknown>;
  const markdown = typeof json?.markdown === 'string' ? json.markdown : '';

  return (
    <AiContentViewer
      contentId={record.id}
      topic={record.topic}
      subject={record.subject}
      grade={record.grade}
      board={record.board}
      markdown={markdown}
    />
  );
}
