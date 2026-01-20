/*
 * Fetch recent AIContentLog rows to inspect LLM responses.
 */
require('dotenv').config({ path: '.env.production' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const rows = await prisma.aIContentLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        model: true,
        promptType: true,
        success: true,
        status: true,
        error: true,
        requestBody: true,
        responseBody: true,
        createdAt: true
      }
    });
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
