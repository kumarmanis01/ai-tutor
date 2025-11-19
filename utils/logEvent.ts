import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Prisma } from '@prisma/client';

/**
 * Logs an event to the Event model.
 *
 * @param type - The type of the event (e.g., 'badge_shared', 'analytics_event').
 * @param metadata - Additional metadata for the event.
 */
export async function logEvent(
  type: string,
  metadata: Prisma.InputJsonValue = {}, // Ensure metadata matches Prisma's InputJsonValue type
): Promise<void> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Ensure userId exists in the User table
    if (!userId) {
      console.warn(`Skipping event logging due to missing userId.`);
      return;
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      console.warn(`Skipping event logging: userId ${userId} does not exist.`);
      return;
    }

    await prisma.event.create({
      data: {
        userId,
        type,
        metadata, // Pass metadata as Prisma.InputJsonValue
        timestamp: new Date(),
      },
    });
    console.log(`Event logged: type=${type}, userId=${userId}`);
  } catch (error) {
    console.error(`Failed to log event: type=${type}`, error);
  }
}
