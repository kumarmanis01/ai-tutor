// Quick test script to check if PrismaClient works
(async () => {
  try {
    const m = await import('../dist/lib/prisma.js');
    console.log('prisma type:', typeof m.prisma);
    console.log('prisma keys:', Object.keys(m.prisma || {}).slice(0, 10));
    console.log('has $connect:', typeof m.prisma.$connect);
    if (typeof m.prisma.$connect === 'function') {
      console.log('Attempting $connect...');
      await m.prisma.$connect();
      console.log('$connect succeeded!');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
})();
