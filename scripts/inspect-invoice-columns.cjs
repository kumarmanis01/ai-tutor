const { prisma } = require('../lib/prisma');
(async () => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name ILIKE 'invoice' ORDER BY ordinal_position"
    );
    console.log('invoice columns:', rows);
  } catch (err) {
    console.error('error inspecting invoice columns:', String(err));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
