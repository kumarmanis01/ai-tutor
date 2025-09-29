import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { SessionUser } from '@/lib/types';

/**
 * Persists chat history for a logged-in user
 * Request: { messages: [{ role: "user"|"ai", content: string }] }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sessionUser = session.user as SessionUser;

  if (!sessionUser || !sessionUser.email || !sessionUser.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { messages } = body;

    await prisma.chatHistory.create({
      data: {
        userId: sessionUser.id, // Now guaranteed to be string
        messages: JSON.stringify(messages),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('SaveChats API error:', err);
    return NextResponse.json({ error: 'Failed to save chats' }, { status: 500 });
  }
}
