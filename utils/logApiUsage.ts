import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function logApiUsage(endpoint: string, method: string) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Ensure userId is valid
    if (!userId) {
      console.warn(
        `Skipping API usage logging for endpoint: ${endpoint}, method: ${method} due to missing userId.`,
      );
      return;
    }

    await prisma.apiUsage.upsert({
      where: {
        userId_endpoint_method: { userId, endpoint, method },
      },
      update: { count: { increment: 1 }, lastUsed: new Date() },
      create: { userId, endpoint, method, count: 1, lastUsed: new Date() },
    });
    console.log(`API usage logged: endpoint=${endpoint}, method=${method}`);
  } catch (error) {
    console.error(`Failed to log API usage for endpoint: ${endpoint}, method: ${method}`, error);
  }
}
