import('./dist/lib/prisma.js').then(async ({ prisma }) => {
  try {
    const jobs = await prisma.hydrationJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, status: true, bullJobId: true, createdAt: true, updatedAt: true, meta: true }
    });
    console.log('HYDRATION_JOBS:');
    console.log(JSON.stringify(jobs, null, 2));

    const lifecycles = await prisma.workerLifecycle.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, type: true, status: true, pid: true, host: true, createdAt: true, updatedAt: true }
    });
    console.log('\nWORKER_LIFECYCLES:');
    console.log(JSON.stringify(lifecycles, null, 2));
  }
  catch (err) {
    console.error('QUERY ERROR:', err);
  }
  finally {
    try { await prisma.$disconnect(); } catch {}
  }
}).catch(e=>{ console.error('IMPORT PRISMA ERROR', e) });
