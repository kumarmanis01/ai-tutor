import { PrismaClient } from '@prisma/client';

// Define a global type for PrismaClient caching
interface GlobalPrisma {
  __prisma?: PrismaClient;
}

const globalForPrisma = globalThis as unknown as GlobalPrisma;

export const prisma: PrismaClient =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });

if (process.env.NODE_ENV === 'development') {
  globalForPrisma.__prisma = prisma;
}
