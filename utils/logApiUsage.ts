import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Logs API usage to the database.
 *
 * @param endpoint - The API endpoint being accessed.
 * @param method - The HTTP method used (e.g., GET, POST).
 */
export function logApiUsage(endpoint: string, method: string) {
  (async () => {
    try {
      console.error(`Invoked Endpoint: ${endpoint} Method: ${method}`);
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id || '-1';

      await prisma.apiUsage.upsert({
        where: {
          userId_endpoint_method: { userId, endpoint, method },
        },
        update: {
          count: { increment: 1 },
          lastUsed: new Date(),
        },
        create: {
          userId,
          endpoint,
          method,
          count: 1,
          lastUsed: new Date(),
        },
      });
    } catch (err) {
      console.error(`Failed to log API usage for ${endpoint}:`, err);
    }
  })();
}
