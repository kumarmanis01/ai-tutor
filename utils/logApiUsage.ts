import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function logApiUsage(endpoint: string, method: string) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // If userId is present, verify the user exists in the DB before attempting
    // to write a foreign-keyed ApiUsage row. If the user does not exist, fall
    // back to creating an anonymous usage record (userId = null) to avoid
    // foreign-key constraint failures.
    if (userId) {
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (userExists) {
        await prisma.apiUsage.upsert({
          where: {
            userId_endpoint_method: { userId, endpoint, method },
          },
          update: { count: { increment: 1 }, lastUsed: new Date() },
          create: { userId, endpoint, method, count: 1, lastUsed: new Date() },
        });
        console.log(`API usage logged: endpoint=${endpoint}, method=${method}, userId=${userId}`);
        return;
      }
      // If we get here, session claimed a userId that does not exist in the DB.
      console.warn(
        `Session has userId=${userId} but no such user exists in DB — logging as anonymous for endpoint=${endpoint}`,
      );
    } else {
      console.warn(
        `No authenticated user for endpoint=${endpoint}, method=${method} — logging as anonymous.`,
      );
    }

    // Create an anonymous usage record (userId=null). Use create instead of
    // upsert because the composite unique key includes userId and may not be
    // usable when userId is null.
    await prisma.apiUsage.create({
      data: { userId: null, endpoint, method, count: 1, lastUsed: new Date() },
    });
    console.log(`API usage logged: endpoint=${endpoint}, method=${method}`);
  } catch (error) {
    console.error(`Failed to log API usage for endpoint: ${endpoint}, method: ${method}`, error);
  }
}
