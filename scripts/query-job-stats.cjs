const { PrismaClient } = require('@prisma/client');

(async function main(){
  const prisma = new PrismaClient();
  try{
    const res = await prisma.$queryRawUnsafe('SELECT "status", count(*) FROM "HydrationJob" GROUP BY "status";');
    console.log('HydrationJob counts by status:');
    console.log(res);

    const exec = await prisma.$queryRawUnsafe('SELECT "status", count(*) FROM "ExecutionJob" GROUP BY "status";');
    console.log('ExecutionJob counts by status:');
    console.log(exec);
  }catch(e){
    console.error('Error:', e && e.message ? e.message : e);
    process.exit(1);
  }finally{
    await prisma.$disconnect();
  }
})();
