import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';

/**
 * API Route: Get details and messages for a specific room.
 * Compatible with Next.js App Router dynamic route signature.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { members: true },
  });
  const messages = await prisma.message.findMany({
    where: { roomId },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ room, messages });
}
