import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.topicNote.update({
    where: { id },
    data: { lifecycle: 'deleted' },
  });
  return NextResponse.json({ unpublished: true });
}
