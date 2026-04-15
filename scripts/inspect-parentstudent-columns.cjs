const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name ILIKE 'parentstudent' ORDER BY ordinal_position");
    console.log('parentstudent columns:', rows);
  } catch (err) {
    console.error('error inspecting parentstudent columns:', String(err));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
