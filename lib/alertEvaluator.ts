/** Minimal stub to keep integration compile passing. */
import { PrismaClient } from '@prisma/client';

export async function evaluateAlerts(_prisma: PrismaClient, _opts?: Record<string, unknown>) {
  return [] as any[];
}

export default evaluateAlerts;
