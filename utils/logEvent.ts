import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

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
    const session = await getServerSessionForHandlers();
    const userId = session?.user?.id;

    // Ensure userId exists in the User table
    if (!userId) {
      logger.warn(`Skipping event logging due to missing userId.`, { className: 'logEvent', methodName: 'logEvent' });
      return;
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      logger.warn(`Skipping event logging: userId ${userId} does not exist.`, { className: 'logEvent', methodName: 'logEvent' });
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
    // Log using central logger
    logger.add(`Event logged: type=${type}, userId=${userId}`, { className: 'logEvent', methodName: 'logEvent' });
  } catch (error) {
    logger.error(`Failed to log event: type=${type} - ${String(error)}`, { className: 'logEvent', methodName: 'logEvent' });
  }
}
