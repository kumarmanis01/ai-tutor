import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * API Route: Send a message to a study room.
 *
 * Expects POST request with JSON body:
 * {
 *   roomId: string,
 *   content: string
 * }
 *
 * The sender must be authenticated.
 * If the message contains a question (includes '?'), an AI moderator stub will respond.
 * Returns the created message.
 */
export async function POST(req: Request) {
  // Authenticate user
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body
  const { roomId, content } = await req.json();

  // Create user message
  const message = await prisma.message.create({
    data: {
      roomId,
      senderId: session.user.id,
      sender: session.user.name,
      role: 'user',
      content,
    },
  });

  // AI moderator stub: respond if message contains a question
  if (content.includes('?')) {
    await prisma.message.create({
      data: {
        roomId,
        senderId: 'ai-moderator',
        sender: 'AI Tutor',
        role: 'assistant',
        content: "Here's an AI answer to your question!",
      },
    });
  }

  // Return the created message
  return NextResponse.json(message);
}
