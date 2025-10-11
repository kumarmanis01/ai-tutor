import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * API Route: Create a new study room.
 *
 * Expects POST request with JSON body:
 * {
 *   name: string,
 *   subject: string,
 *   description?: string,
 *   isPrivate?: boolean
 * }
 *
 * Returns the created room object.
 * The creator is automatically added as an admin member.
 */
export async function POST(req: Request) {
  // Authenticate user
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body
  const { name, subject, description, isPrivate } = await req.json();

  // Create room and add creator as admin member
  const room = await prisma.room.create({
    data: {
      name,
      subject,
      description,
      isPrivate,
      createdBy: session.user.id,
      members: {
        create: [{ userId: session.user.id, role: 'admin' }],
      },
    },
  });

  // Return created room
  return NextResponse.json(room);
}
