import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logApiUsage } from '@/utils/logApiUsage';

/**
 * API Route: Create a new study room (topic-based).
 *
 * Expects POST request with JSON body:
 * {
 *   name?: string,
 *   subject?: string,
 *   topic?: string, // allow creation by topic name
 *   description?: string,
 *   isPrivate?: boolean,
 *   createdByAI?: boolean
 * }
 *
 * Returns the created room object.
 * The creator is automatically added as an admin member.
 */
export async function POST(req: Request) {
  logApiUsage('/api/rooms/create', 'POST');

  // Authenticate user
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body
  const { name, subject, topic, description, isPrivate, createdByAI } = await req.json();

  // Allow creation by topic name
  const roomName = name || topic;
  if (!roomName) {
    return NextResponse.json({ error: 'Room name or topic is required' }, { status: 400 });
  }

  // Set createdByAI: true if created by AI (e.g., topic provided and createdByAI is true)
  const isCreatedByAI = Boolean(createdByAI) || Boolean(topic && !name);

  // Create room and add creator as admin member
  const room = await prisma.room.create({
    data: {
      name: roomName,
      subject,
      description,
      isPrivate,
      createdBy: session.user.id,
      createdByAI: isCreatedByAI,
      members: {
        create: [{ userId: session.user.id, role: 'admin' }],
      },
    },
    include: {
      members: true,
    },
  });

  // Return created room
  return NextResponse.json(room);
}
