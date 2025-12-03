import { prisma } from '@/lib/db';

/**
 * Log API usage. Callers should pass `userId` when available to avoid
 * performing server-only operations (like reading headers or session) inside
 * this utility. Keeping this function pure-server-free avoids dynamic server
 * usage during static generation.
 */
export async function logApiUsage(endpoint: string, method: string, userId?: string | null) {
  try {
    // If we don't have a concrete userId, create an anonymous usage record.
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      await prisma.apiUsage.create({
        data: { userId: null, endpoint, method, count: 1, lastUsed: new Date() },
      });
      console.debug(`[logApiUsage] anonymous: ${endpoint} ${method}`);
      return;
    }

    // Ensure the user exists before writing a FK'd row.
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      console.warn(`[logApiUsage] userId=${userId} not found; logging as anonymous ${endpoint} ${method}`);
      await prisma.apiUsage.create({ data: { userId: null, endpoint, method, count: 1, lastUsed: new Date() } });
      return;
    }

    await prisma.apiUsage.upsert({
      where: { userId_endpoint_method: { userId, endpoint, method } },
      update: { count: { increment: 1 }, lastUsed: new Date() },
      create: { userId, endpoint, method, count: 1, lastUsed: new Date() },
    });
    console.debug(`[logApiUsage] userId=${userId} ${endpoint} ${method}`);
  } catch (error) {
    console.error(`Failed to log API usage for endpoint: ${endpoint}, method: ${method}`, error);
  }
}
