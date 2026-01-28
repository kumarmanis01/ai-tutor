const { PrismaClient } = require('@prisma/client');

(async function main(){
  const prisma = new PrismaClient();
  try{
    const rows = await prisma.hydrationJob.findMany({ where: { status: 'failed' }, orderBy: { updatedAt: 'desc' }, take: 20 });
    for(const r of rows){
      console.log('---');
      console.log({ id: r.id, jobType: r.jobType, topicId: r.topicId, attempts: r.attempts, lastError: r.lastError, updatedAt: r.updatedAt });
    }
  }catch(e){
    console.error('Error:', e && e.message ? e.message : e);
    process.exit(1);
  }finally{
    await prisma.$disconnect();
  }
})();
